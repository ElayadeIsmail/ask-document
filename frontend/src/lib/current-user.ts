import { cacheLife } from "next/cache";
import { cookies } from "next/headers";

import { apiPath } from "@/lib/api-prefix";
import { SESSION_COOKIE } from "@/lib/cookie";
import { apiUrl } from "@/lib/server-api";
import type { AuthUser } from "@/lib/types";

export async function getCurrentUser(): Promise<AuthUser | null> {
  "use cache: private";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const response = await fetch(`${apiUrl()}${apiPath("/auth/me")}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<AuthUser>;
}

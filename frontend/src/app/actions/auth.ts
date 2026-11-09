"use server";

import { cookies } from "next/headers";

import { apiPath } from "@/lib/api-prefix";
import { SESSION_COOKIE, sessionCookie } from "@/lib/cookie";
import { apiUrl, errorDetail } from "@/lib/server-api";
import type { AuthUser } from "@/lib/types";

type AuthResult = { user: AuthUser } | { error: string };

async function startSession(path: string, body: unknown): Promise<AuthResult> {
  const response = await fetch(`${apiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return { error: errorDetail(payload, "Could not sign in") };

  const data = payload as { access_token: string; user: AuthUser };
  const store = await cookies();
  store.set(SESSION_COOKIE, data.access_token, sessionCookie);
  return { user: data.user };
}

export async function login(email: string, password: string) {
  return startSession(apiPath("/auth/login"), { email, password });
}

export async function signup(email: string, username: string, password: string) {
  return startSession(apiPath("/auth/signup"), { email, username, password });
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

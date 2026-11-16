import { cookies } from "next/headers";

import { Workspace } from "@/components/workspace";
import { COLLECTION_COOKIE } from "@/lib/cookie";
import { getCurrentUser } from "@/lib/current-user";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const preferred = (await cookies()).get(COLLECTION_COOKIE)?.value ?? null;
  return <Workspace user={user} initialCollectionId={preferred} view={{ kind: "home" }} />;
}

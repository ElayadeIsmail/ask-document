import { Workspace } from "@/components/workspace";
import { getCurrentUser } from "@/lib/current-user";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  return <Workspace user={user} view={{ kind: "admin" }} />;
}

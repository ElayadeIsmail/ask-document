import { Workspace } from "@/components/workspace";
import { getCurrentUser } from "@/lib/current-user";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  return <Workspace user={user} view={{ kind: "document", documentId }} />;
}
import { Workspace } from "@/components/workspace";
import { getCurrentUser } from "@/lib/current-user";

export default async function CollectionDocumentPage({
  params,
}: {
  params: Promise<{ collectionId: string; documentId: string }>;
}) {
  const { collectionId, documentId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <Workspace user={user} view={{ kind: "collection-document", collectionId, documentId }} />
  );
}

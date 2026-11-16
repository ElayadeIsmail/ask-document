import { Workspace } from "@/components/workspace";
import { getCurrentUser } from "@/lib/current-user";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  return <Workspace user={user} view={{ kind: "collection", collectionId }} />;
}

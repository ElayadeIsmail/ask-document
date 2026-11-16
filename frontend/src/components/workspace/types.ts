import type { AuthUser } from "@/lib/types";

export type WorkspaceView =
  | { kind: "home" }
  | { kind: "admin" }
  | { kind: "collection"; collectionId: string }
  | { kind: "collection-document"; collectionId: string; documentId: string }
  | { kind: "document"; documentId: string };

export type WorkspaceProps = {
  user: AuthUser;
  view: WorkspaceView;
  initialCollectionId?: string | null;
};

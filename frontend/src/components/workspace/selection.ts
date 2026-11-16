import type { Collection, DocumentRecord, SharedDocument } from "@/lib/types";

import type { WorkspaceView } from "./types";

export type WorkspaceScope = {
  ownedCollectionId: string | null;
  adminView: boolean;
  showLibrary: boolean;
};

export type WorkspaceScreen = WorkspaceScope & {
  shared: SharedDocument | null;
  selectedDocumentId: string | null;
  documentChat: boolean;
  activeDocument: DocumentRecord | null;
  readOnly: boolean;
  visibleDocuments: DocumentRecord[];
  visibleCollection: Collection | null;
  canAsk: boolean;
  openingDocument: boolean;
  missingDocument: boolean;
  sidebarCollectionId: string | null;
  askHint: string | null;
};

export function sharedDocument(view: WorkspaceView, accepted: SharedDocument[]): SharedDocument | null {
  if (view.kind !== "document") return null;
  return accepted.find((item) => item.id === view.documentId) ?? null;
}

export function documentLookupId(
  view: WorkspaceView,
  sharesReady: boolean,
  shared: SharedDocument | null,
): string | null {
  if (view.kind !== "document" || !sharesReady || shared) return null;
  return view.documentId;
}

export function resolveScope(input: {
  view: WorkspaceView;
  collections: Collection[];
  shared: SharedDocument | null;
  direct: DocumentRecord | undefined;
  collectionsReady: boolean;
  sharesReady: boolean;
  role: string;
}): WorkspaceScope {
  const { view, collections, shared, direct, collectionsReady, sharesReady, role } = input;
  const routedId =
    view.kind === "collection" || view.kind === "collection-document" ? view.collectionId : null;

  const ownedCollectionId = collections.some((item) => item.id === routedId)
    ? routedId
    : direct && collections.some((item) => item.id === direct.collection_id)
      ? direct.collection_id
      : null;

  const adminView =
    collectionsReady &&
    sharesReady &&
    view.kind === "document" &&
    Boolean(direct) &&
    !shared &&
    !ownedCollectionId &&
    role === "admin";

  return {
    ownedCollectionId,
    adminView,
    showLibrary: Boolean(ownedCollectionId) && !shared && view.kind !== "admin",
  };
}

export function resolveScreen(input: {
  view: WorkspaceView;
  scope: WorkspaceScope;
  collections: Collection[];
  documents: DocumentRecord[];
  shared: SharedDocument | null;
  direct: DocumentRecord | undefined;
  collectionsReady: boolean;
  sharesReady: boolean;
  directLoading: boolean;
  directError: boolean;
}): WorkspaceScreen {
  const { view, scope, collections, documents, shared, direct } = input;
  const { ownedCollectionId, adminView, showLibrary } = scope;
  const soleDocumentId = showLibrary && documents.length === 1 ? documents[0].id : null;
  const selectedDocumentId = shared
    ? shared.id
    : adminView && direct
      ? direct.id
      : documentIdOnRoute(view, ownedCollectionId, soleDocumentId);
  const documentChat = Boolean(selectedDocumentId);
  const matchedDocument = documents.find((item) => item.id === selectedDocumentId) ?? null;
  const activeDocument = shared ?? (adminView && direct ? direct : matchedDocument);
  const selectedCollection = collections.find((item) => item.id === ownedCollectionId) ?? null;

  return {
    ...scope,
    shared,
    selectedDocumentId,
    documentChat,
    activeDocument,
    readOnly: Boolean(shared || adminView),
    visibleDocuments: adminView && direct ? [direct] : shared ? [shared] : documents,
    visibleCollection: labeledCollection(adminView, direct, shared, selectedCollection),
    canAsk: documentChat
      ? Boolean(activeDocument?.status === "ready" && !adminView)
      : Boolean(selectedCollection && documents.some((doc) => doc.status === "ready")),
    openingDocument:
      view.kind === "document" &&
      !shared &&
      (!input.sharesReady || !input.collectionsReady || input.directLoading),
    missingDocument:
      view.kind === "document" &&
      input.sharesReady &&
      input.collectionsReady &&
      !shared &&
      !ownedCollectionId &&
      !adminView &&
      (input.directError || Boolean(direct)),
    sidebarCollectionId: shared || view.kind === "admin" ? null : ownedCollectionId,
    askHint: hintForAsk(shared, adminView, documentChat),
  };
}

function documentIdOnRoute(
  view: WorkspaceView,
  ownedCollectionId: string | null,
  soleDocumentId: string | null,
): string | null {
  if (view.kind === "collection-document") return view.documentId;
  if (view.kind === "document" && ownedCollectionId) return view.documentId;
  return soleDocumentId;
}

function labeledCollection(
  adminView: boolean,
  direct: DocumentRecord | undefined,
  shared: SharedDocument | null,
  selected: Collection | null,
): Collection | null {
  if (adminView && direct) {
    return collectionFromDocument(direct, "Opened from the users list. You can read this chat.");
  }
  if (shared) return collectionFromDocument(shared, `Shared by ${shared.shared_by}`);
  return selected;
}

function hintForAsk(shared: SharedDocument | null, adminView: boolean, documentChat: boolean) {
  if (shared) return `Shared by ${shared.shared_by}`;
  if (adminView) return "Read only";
  if (documentChat) return "Visible to people with access";
  return null;
}

function collectionFromDocument(document: DocumentRecord, description: string): Collection {
  return {
    id: document.collection_id || document.id,
    name: document.structured_info?.title || document.filename,
    description,
    document_count: 1,
    ready_count: document.status === "ready" ? 1 : 0,
    created_at: document.created_at,
  };
}

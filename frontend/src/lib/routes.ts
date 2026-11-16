export function collectionPath(collectionId: string) {
  return `/collection/${collectionId}`;
}

export function collectionDocumentPath(collectionId: string, documentId: string) {
  return `/collection/${collectionId}/${documentId}`;
}

export function documentPath(documentId: string) {
  return `/document/${documentId}`;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { rememberCollection } from "@/lib/cookie";
import { collectionPath, documentPath } from "@/lib/routes";
import type { Collection, DocumentRecord } from "@/lib/types";

import type { WorkspaceView } from "./types";

type RedirectInput = {
  view: WorkspaceView;
  collectionsReady: boolean;
  collections: Collection[];
  initialCollectionId: string | null;
  ownedCollectionId: string | null;
  documentsReady: boolean;
  documents: DocumentRecord[] | undefined;
  showLibrary: boolean;
};

export function useWorkspaceRedirects({
  view,
  collectionsReady,
  collections,
  initialCollectionId,
  ownedCollectionId,
  documentsReady,
  documents,
  showLibrary,
}: RedirectInput) {
  const router = useRouter();

  useEffect(() => {
    if (ownedCollectionId) rememberCollection(ownedCollectionId);
  }, [ownedCollectionId]);

  useEffect(() => {
    if (view.kind !== "home" || !collectionsReady || collections.length === 0) return;
    const preferred = collections.some((item) => item.id === initialCollectionId)
      ? initialCollectionId
      : collections[0].id;
    if (preferred) router.replace(collectionPath(preferred));
  }, [collectionsReady, initialCollectionId, collections, view.kind, router]);

  useEffect(() => {
    if (!collectionsReady) return;
    if (view.kind !== "collection" && view.kind !== "collection-document") return;
    if (collections.some((item) => item.id === view.collectionId)) return;
    router.replace("/");
  }, [collectionsReady, collections, view, router]);

  useEffect(() => {
    if (!documentsReady || !documents || !ownedCollectionId) return;
    const onThisCollection =
      (view.kind === "collection" || view.kind === "collection-document") &&
      view.collectionId === ownedCollectionId;

    if (onThisCollection && documents.length === 1) {
      router.replace(documentPath(documents[0].id));
      return;
    }

    if (view.kind === "collection-document" && view.collectionId === ownedCollectionId) {
      const stillThere = documents.some((item) => item.id === view.documentId);
      if (!stillThere) router.replace(collectionPath(ownedCollectionId));
      return;
    }

    if (view.kind === "document" && showLibrary) {
      const stillThere = documents.some((item) => item.id === view.documentId);
      if (stillThere) return;
      if (documents.length === 1) router.replace(documentPath(documents[0].id));
      else router.replace(collectionPath(ownedCollectionId));
    }
  }, [documentsReady, documents, ownedCollectionId, view, router, showLibrary]);
}

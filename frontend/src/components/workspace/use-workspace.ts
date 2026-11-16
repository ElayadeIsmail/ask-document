"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { logout } from "@/app/actions/auth";
import {
  useAdminUsers,
  useCollectionMessages,
  useCollections,
  useDocument,
  useDocuments,
  useHealth,
  useLibraryMutations,
  useMessages,
  useShares,
} from "@/hooks/use-library";
import { api, type AskStreamEvent } from "@/lib/api";
import { applyStreamEvent, messagesToTurns, withPendingTurn } from "@/lib/chat";
import { collectionDocumentPath, collectionPath, documentPath } from "@/lib/routes";
import type { ChatTurn, DocumentRecord } from "@/lib/types";

import { documentLookupId, resolveScope, resolveScreen, sharedDocument } from "./selection";
import type { WorkspaceProps } from "./types";
import { useWorkspaceRedirects } from "./use-workspace-redirects";

export function useWorkspace({ user, view, initialCollectionId = null }: WorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const collectionsQuery = useCollections();
  const health = useHealth();
  const shares = useShares();
  const mutations = useLibraryMutations();

  const [pendingTurn, setPendingTurn] = useState<ChatTurn | null>(null);
  const [shareTarget, setShareTarget] = useState<DocumentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const collections = useMemo(() => collectionsQuery.data ?? [], [collectionsQuery.data]);
  const shared = sharedDocument(view, shares.accepted);
  const directQuery = useDocument(documentLookupId(view, shares.ready, shared));
  const scope = resolveScope({
    view,
    collections,
    shared,
    direct: directQuery.data,
    collectionsReady: collectionsQuery.isSuccess,
    sharesReady: shares.ready,
    role: user.role,
  });
  const documentsQuery = useDocuments(scope.ownedCollectionId, scope.showLibrary);
  const documents = documentsQuery.data ?? [];
  const screen = resolveScreen({
    view,
    scope,
    collections,
    documents,
    shared,
    direct: directQuery.data,
    collectionsReady: collectionsQuery.isSuccess,
    sharesReady: shares.ready,
    directLoading: directQuery.isLoading,
    directError: directQuery.isError,
  });

  const streaming = Boolean(pendingTurn?.pending);
  const messages = useMessages(screen.documentChat ? screen.selectedDocumentId : null, streaming);
  const collectionMessages = useCollectionMessages(
    !screen.documentChat && scope.showLibrary ? scope.ownedCollectionId : null,
    streaming,
  );
  const adminUsers = useAdminUsers(view.kind === "admin" && user.role === "admin");
  const savedMessages = screen.documentChat ? messages.data : collectionMessages.data;
  const turns = useMemo(
    () => withPendingTurn(messagesToTurns(savedMessages ?? []), pendingTurn),
    [savedMessages, pendingTurn],
  );

  useWorkspaceRedirects({
    view,
    collectionsReady: collectionsQuery.isSuccess,
    collections,
    initialCollectionId,
    ownedCollectionId: scope.ownedCollectionId,
    documentsReady: documentsQuery.isSuccess,
    documents: documentsQuery.data,
    showLibrary: scope.showLibrary,
  });

  function chooseCollection(id: string) {
    const cached = queryClient.getQueryData<DocumentRecord[]>(["documents", id]);
    if (cached?.length === 1) router.push(documentPath(cached[0].id));
    else router.push(collectionPath(id));
  }

  function openDocument(id: string) {
    if (!scope.ownedCollectionId) {
      router.push(documentPath(id));
      return;
    }
    if (documents.length <= 1) router.push(documentPath(id));
    else router.push(collectionDocumentPath(scope.ownedCollectionId, id));
  }

  async function ask(question: string) {
    if (screen.adminView) return;
    const documentId = screen.documentChat ? screen.selectedDocumentId : null;
    const collectionId = documentId ? null : scope.ownedCollectionId;
    if (!documentId && !collectionId) return;

    const id = crypto.randomUUID();
    setPendingTurn({ id, question, pending: true, username: user.username, userId: user.id });
    const onEvent = (event: AskStreamEvent) => {
      setPendingTurn((turn) => (turn && turn.id === id ? applyStreamEvent(turn, event) : turn));
    };

    try {
      if (documentId) {
        await api.streamDocumentMessage(documentId, question, onEvent);
        queryClient.setQueryData(["messages", documentId], await api.listMessages(documentId));
      } else {
        await api.streamCollectionMessage(collectionId!, question, undefined, onEvent);
        queryClient.setQueryData(
          ["collection-messages", collectionId],
          await api.listCollectionMessages(collectionId!),
        );
      }
      setPendingTurn(null);
    } catch (err) {
      const message = errorText(err, "Question failed");
      setError(message);
      setPendingTurn((turn) =>
        turn ? { ...turn, pending: false, error: turn.error ?? message } : turn,
      );
    }
  }

  async function upload(files: File[]) {
    if (!scope.ownedCollectionId) return;
    try {
      await mutations.upload.mutateAsync({ collectionId: scope.ownedCollectionId, files });
    } catch (err) {
      setError(errorText(err, "Upload failed"));
    }
  }

  const collectionId = scope.ownedCollectionId;
  const clearScope =
    screen.documentChat && collectionId && documents.length > 1
      ? () => router.push(collectionPath(collectionId))
      : undefined;

  return {
    user,
    view,
    health: health.data ?? null,
    collections,
    incoming: shares.incoming,
    accepted: shares.accepted,
    screen,
    turns,
    adminUsers: adminUsers.data ?? [],
    uploading: mutations.upload.isPending,
    shareTarget,
    error,
    actions: {
      chooseCollection,
      openDocument,
      ask,
      upload,
      clearScope,
      shareDocument: screen.readOnly ? undefined : setShareTarget,
      closeShare: () => setShareTarget(null),
      backToAdmin: screen.adminView ? () => router.push("/admin") : undefined,
      openShared: (id: string) => router.push(documentPath(id)),
      openAdmin: () => router.push("/admin"),
      createCollection: async (name: string) => {
        const created = await mutations.createCollection.mutateAsync(name);
        chooseCollection(created.id);
      },
      deleteCollection: async (id: string) => {
        if (!window.confirm("Delete this collection and its indexed documents?")) return;
        await mutations.deleteCollection.mutateAsync(id);
        if (scope.ownedCollectionId === id) router.push("/");
      },
      acceptShare: async (id: string) => {
        const share = await mutations.acceptShare.mutateAsync(id);
        router.push(documentPath(share.document_id));
      },
      declineShare: async (id: string) => {
        await mutations.declineShare.mutateAsync(id);
      },
      deleteDocument: async (id: string) => {
        await mutations.deleteDocument.mutateAsync(id);
      },
      retryDocument: async (id: string) => {
        await mutations.retryDocument.mutateAsync(id);
      },
      logout: async () => {
        await logout();
        queryClient.clear();
        router.push("/");
        router.refresh();
      },
    },
  };
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export type WorkspaceState = ReturnType<typeof useWorkspace>;

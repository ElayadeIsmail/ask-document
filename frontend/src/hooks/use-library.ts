"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { api } from "@/lib/api";
import type { DocumentRecord } from "@/lib/types";

function indexing(documents: DocumentRecord[] | undefined) {
  return documents?.some((doc) => doc.status === "pending" || doc.status === "processing") ?? false;
}

export function useCollections() {
  return useQuery({ queryKey: ["collections"], queryFn: api.listCollections });
}

export function useDocuments(collectionId: string | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["documents", collectionId],
    queryFn: () => api.listDocuments(collectionId!),
    enabled: Boolean(collectionId) && enabled,
    refetchInterval: (query) => (indexing(query.state.data) ? 2000 : false),
  });

  const busy = enabled && indexing(query.data);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [busy, queryClient]);

  return query;
}

export function useShares() {
  const incoming = useQuery({
    queryKey: ["incoming"],
    queryFn: api.listIncoming,
    refetchInterval: 5000,
  });
  const accepted = useQuery({
    queryKey: ["accepted"],
    queryFn: api.listAccepted,
    refetchInterval: 5000,
  });
  return {
    incoming: incoming.data ?? [],
    accepted: accepted.data ?? [],
    ready: incoming.isSuccess && accepted.isSuccess,
  };
}

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10_000 });
}

export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => api.getDocument(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useMessages(documentId: string | null, pause = false) {
  return useQuery({
    queryKey: ["messages", documentId],
    queryFn: () => api.listMessages(documentId!),
    enabled: Boolean(documentId),
    refetchInterval: documentId && !pause ? 2000 : false,
  });
}

export function useCollectionMessages(collectionId: string | null, pause = false) {
  return useQuery({
    queryKey: ["collection-messages", collectionId],
    queryFn: () => api.listCollectionMessages(collectionId!),
    enabled: Boolean(collectionId),
    refetchInterval: collectionId && !pause ? 2000 : false,
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: api.listAdminUsers,
    enabled,
  });
}

export function useLibraryMutations() {
  const queryClient = useQueryClient();
  const refreshLibrary = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["collections"] }),
      queryClient.invalidateQueries({ queryKey: ["documents"] }),
    ]);
  const refreshShares = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["incoming"] }),
      queryClient.invalidateQueries({ queryKey: ["accepted"] }),
    ]);

  return {
    createCollection: useMutation({
      mutationFn: (name: string) => api.createCollection(name),
      onSuccess: refreshLibrary,
    }),
    deleteCollection: useMutation({
      mutationFn: (id: string) => api.deleteCollection(id),
      onSuccess: refreshLibrary,
    }),
    upload: useMutation({
      mutationFn: ({ collectionId, files }: { collectionId: string; files: File[] }) =>
        api.uploadDocuments(collectionId, files),
      onSuccess: refreshLibrary,
    }),
    deleteDocument: useMutation({
      mutationFn: (id: string) => api.deleteDocument(id),
      onSuccess: refreshLibrary,
    }),
    retryDocument: useMutation({
      mutationFn: (id: string) => api.retryDocument(id),
      onSuccess: refreshLibrary,
    }),
    acceptShare: useMutation({
      mutationFn: (id: string) => api.acceptShare(id),
      onSuccess: refreshShares,
    }),
    declineShare: useMutation({
      mutationFn: (id: string) => api.declineShare(id),
      onSuccess: refreshShares,
    }),
  };
}

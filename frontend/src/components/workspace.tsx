"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AskPanel } from "@/components/ask-panel";
import { Library } from "@/components/library";
import { Sidebar } from "@/components/sidebar";
import { api } from "@/lib/api";
import type { ChatTurn, Collection, DocumentRecord, Health } from "@/lib/types";

const STORAGE_KEY = "askdoc.collection";

export function Workspace() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => collections.find((item) => item.id === selectedId) ?? null,
    [collections, selectedId],
  );
  const canAsk = Boolean(selected && documents.some((doc) => doc.status === "ready"));
  const indexing = documents.some(
    (doc) => doc.status === "pending" || doc.status === "processing",
  );

  const loadCollections = useCallback(async (preferId?: string | null) => {
    const items = await api.listCollections();
    setCollections(items);
    setSelectedId((current) => {
      const next = preferId || current;
      if (next && items.some((item) => item.id === next)) return next;
      return items[0]?.id ?? null;
    });
  }, []);

  const loadDocuments = useCallback(async (collectionId: string) => {
    const items = await api.listDocuments(collectionId);
    setDocuments(items);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    void (async () => {
      try {
        const [liveHealth] = await Promise.all([
          api.health().catch(() => null),
          loadCollections(stored),
        ]);
        setHealth(liveHealth);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot reach the API");
      }
    })();
  }, [loadCollections]);

  useEffect(() => {
    if (!selectedId) {
      setDocuments([]);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, selectedId);
    setTurns([]);
    setScopeIds([]);
    void loadDocuments(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    });
  }, [loadDocuments, selectedId]);

  useEffect(() => {
    if (!selectedId || !indexing) return;
    const timer = window.setInterval(() => {
      void Promise.all([loadDocuments(selectedId), loadCollections(selectedId)]);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [indexing, loadCollections, loadDocuments, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void api.health().then(setHealth).catch(() => setHealth(null));
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  async function createCollection(name: string) {
    const created = await api.createCollection(name);
    await loadCollections(created.id);
  }

  async function deleteCollection(id: string) {
    if (!window.confirm("Delete this collection and its indexed documents?")) return;
    await api.deleteCollection(id);
    if (selectedId === id) {
      setSelectedId(null);
      window.localStorage.removeItem(STORAGE_KEY);
    }
    await loadCollections();
  }

  async function upload(files: File[]) {
    if (!selectedId) return;
    setUploading(true);
    setError(null);
    try {
      await api.uploadDocuments(selectedId, files);
      await Promise.all([loadDocuments(selectedId), loadCollections(selectedId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(id: string) {
    await api.deleteDocument(id);
    if (selectedId) {
      await Promise.all([loadDocuments(selectedId), loadCollections(selectedId)]);
    }
  }

  async function retryDocument(id: string) {
    setError(null);
    try {
      await api.retryDocument(id);
      if (selectedId) {
        await Promise.all([loadDocuments(selectedId), loadCollections(selectedId)]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  }

  function toggleScope(id: string) {
    setScopeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function ask(question: string) {
    if (!selectedId) return;
    const readyIds = new Set(
      documents.filter((doc) => doc.status === "ready").map((doc) => doc.id),
    );
    const documentIds = scopeIds.filter((id) => readyIds.has(id));
    const history = turns
      .filter((turn) => turn.answer && !turn.pending && !turn.error)
      .slice(-4)
      .map((turn) => ({ question: turn.question, answer: turn.answer as string }));
    const id = crypto.randomUUID();
    setTurns((current) => [...current, { id, question, pending: true }]);
    try {
      await api.askStream(
        question,
        selectedId,
        { documentIds, history },
        (event) => {
          if (event.type === "sources") {
            setTurns((current) =>
              current.map((turn) => (turn.id === id ? { ...turn, sources: event.sources } : turn)),
            );
          } else if (event.type === "token") {
            setTurns((current) =>
              current.map((turn) =>
                turn.id === id ? { ...turn, answer: `${turn.answer ?? ""}${event.text}` } : turn,
              ),
            );
          } else if (event.type === "done") {
            setTurns((current) =>
              current.map((turn) =>
                turn.id === id
                  ? {
                      ...turn,
                      pending: false,
                      answer: event.answer,
                      citations: event.citations,
                      sources: event.sources,
                      model: event.model,
                    }
                  : turn,
              ),
            );
          } else if (event.type === "error") {
            setTurns((current) =>
              current.map((turn) =>
                turn.id === id ? { ...turn, pending: false, error: event.detail } : turn,
              ),
            );
          }
        },
      );
    } catch (err) {
      setTurns((current) =>
        current.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                pending: false,
                error: err instanceof Error ? err.message : "Question failed",
              }
            : turn,
        ),
      );
    }
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col md:flex-row">
      <Sidebar
        collections={collections}
        selectedId={selectedId}
        health={health}
        onSelect={setSelectedId}
        onCreate={createCollection}
        onDelete={deleteCollection}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <Library
          collection={selected}
          documents={documents}
          uploading={uploading}
          scopeIds={scopeIds}
          onUpload={upload}
          onDelete={deleteDocument}
          onRetry={retryDocument}
          onToggleScope={toggleScope}
        />
        <AskPanel
          collection={selected}
          canAsk={canAsk}
          scopeCount={scopeIds.length}
          turns={turns}
          onAsk={ask}
          onClearScope={() => setScopeIds([])}
        />
      </div>
      {error && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper">
          {error}
        </div>
      )}
    </div>
  );
}

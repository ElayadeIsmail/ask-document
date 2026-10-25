"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { DragEvent, useMemo, useRef, useState } from "react";

import type { Collection, DocumentRecord } from "@/lib/types";

type LibraryProps = {
  collection: Collection | null;
  documents: DocumentRecord[];
  uploading: boolean;
  scopeIds: string[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onToggleScope: (id: string) => void;
};

export function Library({
  collection,
  documents,
  uploading,
  scopeIds,
  onUpload,
  onDelete,
  onRetry,
  onToggleScope,
}: LibraryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const ready = documents.filter((doc) => doc.status === "ready").length;
  const busy = documents.some(
    (doc) => doc.status === "pending" || doc.status === "processing",
  );

  const hint = useMemo(() => {
    if (!collection) return "Select or create a collection first.";
    if (documents.length === 0) return "Drop PDFs here to index them.";
    if (busy) return "Indexing in the background…";
    return `${ready} document${ready === 1 ? "" : "s"} ready to ask.`;
  }, [busy, collection, documents.length, ready]);

  function takePdfs(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) =>
      file.name.toLowerCase().endsWith(".pdf"),
    );
    if (files.length) void onUpload(files);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) takePdfs(event.dataTransfer.files);
  }

  if (!collection) {
    return (
      <section className="flex max-h-[32vh] min-h-0 w-full flex-col overflow-hidden border-b border-line bg-paper-2/60 lg:h-full lg:max-h-none lg:w-[22rem] lg:border-b-0 lg:border-r">
        <EmptyPanel title="No collection" body="Create one on the left to start a library." />
      </section>
    );
  }

  return (
    <section className="flex max-h-[38vh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-line bg-paper-2/50 lg:h-full lg:max-h-none lg:w-[22rem] lg:border-b-0 lg:border-r">
      <header className="border-b border-line px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Library</p>
        <h2 className="mt-1 truncate font-serif text-2xl italic">{collection.name}</h2>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </header>

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mx-4 mt-4 cursor-pointer rounded-xl border border-dashed px-4 py-5 text-left transition ${
          dragging
            ? "border-moss bg-moss/5"
            : "border-line bg-paper hover:border-moss/40"
        } disabled:cursor-wait`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper">
            <Upload className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-medium">
              {uploading ? "Uploading…" : "Upload PDFs"}
            </div>
            <div className="text-xs text-muted">Click or drop files · PDF only</div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) takePdfs(event.target.files);
            event.target.value = "";
          }}
        />
      </button>

      <ul className="min-h-0 max-h-56 flex-1 space-y-2 overflow-y-auto p-4 lg:max-h-none">
        {documents.map((document) => {
          const info = document.structured_info;
          const scoped = scopeIds.includes(document.id);
          return (
          <li
            key={document.id}
            className={`rounded-xl border bg-paper px-3 py-3 ${
              scoped ? "border-moss" : "border-line"
            }`}
          >
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-moss" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {info?.title || document.filename}
                </div>
                {info?.title && info.title !== document.filename && (
                  <div className="truncate text-[11px] text-muted">{document.filename}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <StatusPill status={document.status} />
                  {info?.document_type && <span className="capitalize">{info.document_type}</span>}
                  {document.page_count > 0 && <span>{document.page_count} p.</span>}
                  {document.chunk_count > 0 && <span>{document.chunk_count} chunks</span>}
                </div>
                {info?.summary && (
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink/80">{info.summary}</p>
                )}
                {info?.key_topics && info.key_topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {info.key_topics.slice(0, 4).map((topic) => (
                      <span
                        key={topic}
                        className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] text-muted"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
                {document.error_message && (
                  <p className="mt-2 text-xs leading-5 text-clay">{document.error_message}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {document.status === "ready" && (
                    <button
                      type="button"
                      onClick={() => onToggleScope(document.id)}
                      className={`cursor-pointer text-[11px] font-medium ${
                        scoped ? "text-moss" : "text-muted hover:text-ink"
                      }`}
                    >
                      {scoped ? "In this question" : "Ask this file"}
                    </button>
                  )}
                  {document.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => void onRetry(document.id)}
                      className="cursor-pointer text-[11px] font-medium text-clay hover:text-ink"
                    >
                      Retry indexing
                    </button>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Remove ${document.filename}`}
                onClick={() => onDelete(document.id)}
                className="cursor-pointer rounded p-1 text-muted hover:text-clay"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-moss/10 text-moss",
    pending: "bg-amber/10 text-amber",
    processing: "bg-amber/10 text-amber",
    failed: "bg-clay/10 text-clay",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-medium capitalize ${
        styles[status] ?? "bg-line text-muted"
      }`}
    >
      {status}
    </span>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center px-8">
      <h2 className="font-serif text-2xl italic">{title}</h2>
      <p className="mt-2 max-w-[16rem] text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

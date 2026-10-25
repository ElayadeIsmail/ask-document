"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { StatusDot } from "@/components/status-dot";
import type { Collection, Health } from "@/lib/types";

type SidebarProps = {
  collections: Collection[];
  selectedId: string | null;
  health: Health | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function Sidebar({
  collections,
  selectedId,
  health,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
      setName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-white/10 bg-ink text-[#f6f1e8] md:h-full md:w-72 md:border-b-0 md:border-r md:border-white/10">
      <div className="border-b border-white/10 px-5 py-4 lg:py-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">PFE · RAG</p>
        <h1 className="mt-2 font-serif text-3xl italic leading-none">AskDoc</h1>
        <p className="mt-3 hidden text-sm leading-6 text-white/60 md:block">
          Upload a collection, then ask. Answers come with page citations.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
        <StatusDot ok={Boolean(health)} label={health ? "API" : "API down"} />
        <StatusDot ok={Boolean(health?.models.ollama_up)} label="Ollama" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pb-2 pt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Collections
        </div>
        <ul className="min-h-0 max-h-28 space-y-1 overflow-y-auto px-3 pb-3 md:max-h-none md:flex-1">
          {collections.length === 0 ? (
            <li className="px-2 py-6 text-sm leading-6 text-white/45">
              Create a collection to hold your PDFs.
            </li>
          ) : (
            collections.map((collection) => {
              const active = collection.id === selectedId;
              return (
                <li key={collection.id}>
                  <div
                    className={`group flex items-start gap-2 rounded-lg px-3 py-2.5 ${
                      active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(collection.id)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <div className="truncate text-sm font-medium">{collection.name}</div>
                      <div className="mt-0.5 text-[11px] text-white/45">
                        {collection.ready_count}/{collection.document_count} ready
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${collection.name}`}
                      onClick={() => onDelete(collection.id)}
                      className="cursor-pointer rounded p-1 text-white/30 opacity-0 transition group-hover:opacity-100 hover:text-clay"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <form onSubmit={handleCreate} className="border-t border-white/10 p-3">
        <label className="sr-only" htmlFor="collection-name">
          New collection
        </label>
        <div className="flex gap-2">
          <input
            id="collection-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="inline-flex cursor-pointer items-center justify-center rounded-md bg-clay px-3 text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>
    </aside>
  );
}

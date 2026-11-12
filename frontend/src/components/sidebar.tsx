"use client";

import { Bell, LogOut, Plus, Trash2, Users } from "lucide-react";
import { FormEvent, useState } from "react";

import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthUser, Collection, Health, SharedDocument, ShareNotice } from "@/lib/types";

type SidebarProps = {
  user: AuthUser;
  collections: Collection[];
  selectedId: string | null;
  shared: SharedDocument[];
  selectedSharedId: string | null;
  health: Health | null;
  notifications: ShareNotice[];
  adminOpen: boolean;
  onSelect: (id: string) => void;
  onSelectShared: (id: string) => void;
  onOpenAdmin: () => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
  onLogout: () => void;
};

export function Sidebar({
  user,
  collections,
  selectedId,
  shared,
  selectedSharedId,
  health,
  notifications,
  adminOpen,
  onSelect,
  onSelectShared,
  onOpenAdmin,
  onCreate,
  onDelete,
  onAccept,
  onDecline,
  onLogout,
}: SidebarProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);

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
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm">{user.username}</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/40">{user.role}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="icon-dark"
              size="icon-sm"
              aria-label="Notifications"
              onClick={() => setNoticesOpen((open) => !open)}
              className="relative"
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] text-white">
                  {notifications.length}
                </span>
              )}
            </Button>
            <Button variant="icon-dark" size="icon-sm" aria-label="Log out" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {noticesOpen && (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-white/5 p-2">
            {notifications.length === 0 ? (
              <li className="px-2 py-3 text-xs text-white/50">No pending invites.</li>
            ) : (
              notifications.map((notice) => (
                <li key={notice.id} className="rounded-lg bg-white/5 px-2 py-2">
                  <p className="text-xs leading-5">
                    <span className="text-white">{notice.from_username}</span>
                    <span className="text-white/55"> shared </span>
                    <span className="text-white">{notice.filename}</span>
                  </p>
                  <div className="mt-1 flex gap-3">
                    <Button variant="link-dark" size="xs" onClick={() => void onAccept(notice.id)}>
                      Accept
                    </Button>
                    <Button variant="link-muted" size="xs" onClick={() => void onDecline(notice.id)}>
                      Decline
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
        <StatusDot ok={Boolean(health)} label={health ? "API" : "API down"} />
        <StatusDot ok={Boolean(health?.models.ollama_up)} label="Ollama" />
      </div>

      {user.role === "admin" && (
        <Button
          variant="ghost-dark"
          size="sm"
          active={adminOpen}
          onClick={onOpenAdmin}
          className="mx-3 mt-3 w-[calc(100%-1.5rem)] justify-start"
        >
          <Users className="h-4 w-4 text-white/60" />
          Users
        </Button>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pb-2 pt-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Collections
        </div>
        <ul className="min-h-0 max-h-28 space-y-1 overflow-y-auto px-3 pb-3 md:max-h-40 md:flex-none">
          {collections.length === 0 ? (
            <li className="px-2 py-4 text-sm leading-6 text-white/45">
              Create a collection to hold your PDFs.
            </li>
          ) : (
            collections.map((collection) => {
              const active = collection.id === selectedId && !adminOpen;
              return (
                <li key={collection.id}>
                  <div
                    className={`group flex items-start gap-2 rounded-lg px-3 py-2.5 ${
                      active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <Button
                      variant="unstyled"
                      onClick={() => onSelect(collection.id)}
                      className="min-w-0 flex-1 flex-col items-start text-left"
                    >
                      <div className="w-full truncate text-sm font-medium">{collection.name}</div>
                      <div className="mt-0.5 text-[11px] text-white/45">
                        {collection.ready_count}/{collection.document_count} ready
                      </div>
                    </Button>
                    <Button
                      variant="icon-dark"
                      size="icon-sm"
                      aria-label={`Delete ${collection.name}`}
                      onClick={() => onDelete(collection.id)}
                      className="text-white/30 opacity-0 group-hover:opacity-100 hover:bg-transparent hover:text-clay"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="px-5 pb-2 pt-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Shared with me
        </div>
        <ul className="min-h-0 max-h-28 flex-1 space-y-1 overflow-y-auto px-3 pb-3 md:max-h-none">
          {shared.length === 0 ? (
            <li className="px-2 py-4 text-sm leading-6 text-white/45">
              Accepted PDFs show up here.
            </li>
          ) : (
            shared.map((document) => {
              const active = document.id === selectedSharedId;
              const title = document.structured_info?.title || document.filename;
              return (
                <li key={document.id}>
                  <Button
                    variant="ghost-dark"
                    active={active}
                    onClick={() => onSelectShared(document.id)}
                    className="w-full flex-col items-start gap-0 px-3 py-2.5 text-left"
                  >
                    <div className="w-full truncate text-sm font-medium">{title}</div>
                    <div className="mt-0.5 text-[11px] text-white/45">from {document.shared_by}</div>
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <form onSubmit={handleCreate} className="border-t border-white/10 p-3">
        <Label className="sr-only" htmlFor="collection-name">
          New collection
        </Label>
        <div className="flex gap-2">
          <Input
            id="collection-name"
            tone="dark"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New collection"
            className="min-w-0 w-auto flex-1"
          />
          <Button
            type="submit"
            variant="clay"
            size="icon"
            disabled={creating || !name.trim()}
            aria-label="Create collection"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </aside>
  );
}

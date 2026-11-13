"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldCaption, Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { DocumentRecord, ShareNotice, UserPublic } from "@/lib/types";

type ShareDialogProps = {
  document: DocumentRecord;
  onClose: () => void;
};

export function ShareDialog({ document, onClose }: ShareDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserPublic[]>([]);
  const [shares, setShares] = useState<ShareNotice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api
      .listDocumentShares(document.id)
      .then(setShares)
      .catch(() => setShares([]));
  }, [document.id]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = window.setTimeout(() => {
      void api
        .searchUsers(term)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function share(username: string) {
    setBusy(true);
    setError(null);
    try {
      await api.shareDocument(document.id, username);
      setShares(await api.listDocumentShares(document.id));
      setQuery("");
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onClose={onClose}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Share PDF</p>
      <h2 className="mt-1 truncate font-serif text-2xl italic">{document.filename}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        They get a notification and can open this PDF and its chat after they accept.
      </p>
      <Label className="mt-4">
        <FieldCaption>Username</FieldCaption>
        <Input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 2) setResults([]);
          }}
          placeholder="Search by username"
          className="mt-1"
        />
      </Label>
      {results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-line">
          {results.map((person) => (
            <li key={person.id} className="border-b border-line last:border-b-0">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void share(person.username)}
                className="w-full justify-between rounded-none px-3 py-2 text-left"
              >
                <span>{person.username}</span>
                <span className="text-[11px] text-moss">Invite</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      <ul className="mt-4 space-y-2">
        {shares.map((share) => (
          <li key={share.id} className="flex items-center justify-between text-sm">
            <span>{share.to_username}</span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{share.status}</span>
          </li>
        ))}
        {shares.length === 0 && <li className="text-sm text-muted">No invites yet.</li>}
      </ul>
      <Button variant="link" size="sm" onClick={onClose} className="mt-5">
        Close
      </Button>
    </Dialog>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/lib/types";

type AdminPanelProps = {
  users: AdminUser[];
  onOpen: (documentId: string) => void;
};

export function AdminPanel({ users, onOpen }: AdminPanelProps) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-paper px-6 py-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Admin</p>
      <h2 className="mt-1 font-serif text-3xl italic">Users and PDFs</h2>
      <ul className="mt-6 space-y-6">
        {users.map((account) => (
          <li key={account.id} className="rounded-2xl border border-line bg-[#fffdf8] px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{account.username}</h3>
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{account.role}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{account.email}</p>
            {account.documents.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No PDFs yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {account.documents.map((document) => (
                  <li key={document.id}>
                    <Button
                      variant="outline"
                      onClick={() => onOpen(document.id)}
                      className="w-full justify-between gap-3 px-3 py-2 text-left"
                    >
                      <span className="min-w-0 truncate">
                        {document.filename}
                        <span className="ml-2 text-[11px] text-muted">{document.collection_name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted">
                        {document.status}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

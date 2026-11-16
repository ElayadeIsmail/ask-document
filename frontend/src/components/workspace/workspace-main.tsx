"use client";

import { AdminPanel } from "@/components/admin-panel";
import { AskPanel } from "@/components/ask-panel";
import { Library } from "@/components/library";

import type { WorkspaceState } from "./use-workspace";

export function WorkspaceMain({ workspace }: { workspace: WorkspaceState }) {
  const { user, view, screen, turns, adminUsers, uploading, actions } = workspace;

  if (view.kind === "admin") {
    return <AdminPanel users={adminUsers} onOpen={actions.openShared} />;
  }
  if (screen.openingDocument) return <Status title="Opening PDF…" />;
  if (screen.missingDocument) {
    return <Status title="PDF not found" body="This file is not in your library." />;
  }

  return (
    <>
      <Library
        collection={screen.visibleCollection}
        documents={screen.visibleDocuments}
        uploading={uploading}
        selectedDocumentId={screen.selectedDocumentId}
        readOnly={screen.readOnly}
        backLabel={screen.adminView ? "All users" : undefined}
        onBack={actions.backToAdmin}
        onUpload={actions.upload}
        onDelete={actions.deleteDocument}
        onRetry={actions.retryDocument}
        onOpen={actions.openDocument}
        onShare={actions.shareDocument}
      />
      <AskPanel
        collection={screen.visibleCollection}
        canAsk={screen.canAsk}
        turns={turns}
        currentUserId={user.id}
        sharedThread={screen.documentChat}
        readOnly={screen.adminView}
        hint={screen.askHint}
        onAsk={actions.ask}
        onClearScope={actions.clearScope}
      />
    </>
  );
}

function Status({ title, body }: { title: string; body?: string }) {
  return (
    <section className="flex flex-1 items-center justify-center px-8">
      {body ? (
        <div>
          <h2 className="font-serif text-3xl italic">{title}</h2>
          <p className="mt-2 text-sm text-muted">{body}</p>
        </div>
      ) : (
        <h2 className="font-serif text-3xl italic">{title}</h2>
      )}
    </section>
  );
}

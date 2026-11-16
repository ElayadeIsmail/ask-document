"use client";

import { ShareDialog } from "@/components/share-dialog";

import type { WorkspaceProps } from "./types";
import { useWorkspace } from "./use-workspace";
import { WorkspaceMain } from "./workspace-main";
import { WorkspaceSidebar } from "./workspace-sidebar";

export type { WorkspaceView } from "./types";

export function Workspace(props: WorkspaceProps) {
  const workspace = useWorkspace(props);

  return (
    <div className="flex h-dvh min-h-0 flex-col md:flex-row">
      <WorkspaceSidebar workspace={workspace} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <WorkspaceMain workspace={workspace} />
      </div>
      {workspace.shareTarget && (
        <ShareDialog document={workspace.shareTarget} onClose={workspace.actions.closeShare} />
      )}
      {workspace.error && <ErrorToast message={workspace.error} />}
    </div>
  );
}

function ErrorToast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper">
      {message}
    </div>
  );
}

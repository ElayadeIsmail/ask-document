"use client";

import { Sidebar } from "@/components/sidebar";

import type { WorkspaceState } from "./use-workspace";

export function WorkspaceSidebar({ workspace }: { workspace: WorkspaceState }) {
  const { user, collections, accepted, incoming, health, view, screen, actions } = workspace;

  return (
    <Sidebar
      user={user}
      collections={collections}
      selectedId={screen.sidebarCollectionId}
      shared={accepted}
      selectedSharedId={screen.shared?.id ?? null}
      health={health}
      notifications={incoming}
      adminOpen={view.kind === "admin"}
      onSelect={actions.chooseCollection}
      onSelectShared={actions.openShared}
      onOpenAdmin={actions.openAdmin}
      onCreate={actions.createCollection}
      onDelete={actions.deleteCollection}
      onAccept={actions.acceptShare}
      onDecline={actions.declineShare}
      onLogout={actions.logout}
    />
  );
}

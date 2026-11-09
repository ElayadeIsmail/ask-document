import type {
  AdminUser,
  AskResponse,
  AuthUser,
  ChatMessage,
  Citation,
  Collection,
  DocumentRecord,
  Health,
  SearchHit,
  SharedDocument,
  ShareNotice,
  UserPublic,
} from "@/lib/types";

import { apiPath } from "@/lib/api-prefix";

export type PriorTurn = {
  question: string;
  answer: string;
};

export type AskStreamEvent =
  | { type: "sources"; sources: SearchHit[] }
  | { type: "token"; text: string }
  | { type: "done"; answer: string; citations: Citation[]; sources: SearchHit[]; model: string }
  | { type: "error"; detail: string };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function detailOf(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return fallback;
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return fallback;
  return detail
    .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : ""))
    .filter(Boolean)
    .join(", ") || fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiPath(path), { ...init, headers });
  if (response.status === 401) {
    window.dispatchEvent(new Event("askdoc-unauthorized"));
  }
  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(detailOf(payload, response.statusText || "Request failed"), response.status);
  return payload as T;
}

export const api = {
  health: () => request<Health>("/health"),
  me: () => request<AuthUser>("/auth/me"),
  searchUsers: (q: string) => request<UserPublic[]>(`/users?q=${encodeURIComponent(q)}`),
  listAdminUsers: () => request<AdminUser[]>("/admin/users"),
  listIncoming: () => request<ShareNotice[]>("/shares/incoming"),
  listAccepted: () => request<SharedDocument[]>("/shares/accepted"),
  acceptShare: (id: string) => request<ShareNotice>(`/shares/${id}/accept`, { method: "POST" }),
  declineShare: (id: string) => request<ShareNotice>(`/shares/${id}/decline`, { method: "POST" }),
  listDocumentShares: (documentId: string) => request<ShareNotice[]>(`/documents/${documentId}/shares`),
  shareDocument: (documentId: string, username: string) =>
    request<ShareNotice>(`/documents/${documentId}/shares`, {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  getDocument: (id: string) => request<DocumentRecord>(`/documents/${id}`),
  listMessages: (documentId: string) => request<ChatMessage[]>(`/documents/${documentId}/messages`),
  listCollectionMessages: (collectionId: string) =>
    request<ChatMessage[]>(`/collections/${collectionId}/messages`),
  postMessage: (documentId: string, question: string) =>
    request<ChatMessage[]>(`/documents/${documentId}/messages`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  streamDocumentMessage: (
    documentId: string,
    question: string,
    onEvent: (event: AskStreamEvent) => void,
    signal?: AbortSignal,
  ) => readAskStream(`/documents/${documentId}/messages/stream`, { question }, onEvent, signal),
  streamCollectionMessage: (
    collectionId: string,
    question: string,
    documentIds: string[] | undefined,
    onEvent: (event: AskStreamEvent) => void,
    signal?: AbortSignal,
  ) =>
    readAskStream(
      `/collections/${collectionId}/messages/stream`,
      {
        question,
        document_ids: documentIds?.length ? documentIds : null,
      },
      onEvent,
      signal,
    ),
  listCollections: () => request<Collection[]>("/collections"),
  createCollection: (name: string, description?: string) =>
    request<Collection>("/collections", {
      method: "POST",
      body: JSON.stringify({ name, description: description || null }),
    }),
  deleteCollection: (id: string) => request<void>(`/collections/${id}`, { method: "DELETE" }),
  listDocuments: (collectionId: string) =>
    request<DocumentRecord[]>(`/collections/${collectionId}/documents`),
  uploadDocuments: (collectionId: string, files: File[]) => {
    const body = new FormData();
    for (const file of files) body.append("files", file);
    return request<DocumentRecord[]>(`/collections/${collectionId}/documents`, { method: "POST", body });
  },
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  retryDocument: (id: string) => request<DocumentRecord>(`/documents/${id}/retry`, { method: "POST" }),
  ask: (question: string, collectionId: string, options?: { documentIds?: string[]; history?: PriorTurn[] }) =>
    request<AskResponse>("/ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        collection_id: collectionId,
        document_ids: options?.documentIds?.length ? options.documentIds : null,
        history: options?.history ?? [],
      }),
    }),
  askStream: (
    question: string,
    collectionId: string,
    options: { documentIds?: string[]; history?: PriorTurn[] } | undefined,
    onEvent: (event: AskStreamEvent) => void,
    signal?: AbortSignal,
  ) =>
    readAskStream(
      "/ask/stream",
      {
        question,
        collection_id: collectionId,
        document_ids: options?.documentIds?.length ? options.documentIds : null,
        history: options?.history ?? [],
      },
      onEvent,
      signal,
    ),
};

export function fileUrl(documentId: string, page: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  return `${apiPath(`/documents/${documentId}/file`)}#page=${safePage}`;
}

async function readAskStream(
  path: string,
  body: unknown,
  onEvent: (event: AskStreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(apiPath(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401) window.dispatchEvent(new Event("askdoc-unauthorized"));
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(detailOf(payload, response.statusText || "Request failed"), response.status);
  }
  if (!response.body) throw new ApiError("The answer stream was empty", 500);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as AskStreamEvent;
      onEvent(event);
      if (event.type === "error") {
        await reader.cancel();
        throw new ApiError(event.detail || "Question failed", 502);
      }
      if (event.type === "done") finished = true;
    }
  }
  if (!finished) throw new ApiError("The answer stopped before it finished", 500);
}

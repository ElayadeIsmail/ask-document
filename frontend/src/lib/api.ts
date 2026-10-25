import type {
  AskResponse,
  Citation,
  Collection,
  DocumentRecord,
  Health,
  SearchHit,
} from "@/lib/types";

export type PriorTurn = {
  question: string;
  answer: string;
};

export type AskStreamEvent =
  | { type: "sources"; sources: SearchHit[] }
  | { type: "token"; text: string }
  | { type: "done"; answer: string; citations: Citation[]; sources: SearchHit[]; model: string }
  | { type: "error"; detail: string };

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload?.detail === "string"
        ? payload.detail
        : Array.isArray(payload?.detail)
          ? payload.detail.map((item: { msg?: string }) => item.msg).join(", ")
          : response.statusText;
    throw new ApiError(detail || "Request failed", response.status);
  }
  return payload as T;
}

export const api = {
  health: () => request<Health>("/api/v1/health"),

  listCollections: () => request<Collection[]>("/api/v1/collections"),

  createCollection: (name: string, description?: string) =>
    request<Collection>("/api/v1/collections", {
      method: "POST",
      body: JSON.stringify({ name, description: description || null }),
    }),

  deleteCollection: (id: string) =>
    request<void>(`/api/v1/collections/${id}`, { method: "DELETE" }),

  listDocuments: (collectionId: string) =>
    request<DocumentRecord[]>(`/api/v1/collections/${collectionId}/documents`),

  uploadDocuments: (collectionId: string, files: File[]) => {
    const body = new FormData();
    for (const file of files) body.append("files", file);
    return request<DocumentRecord[]>(`/api/v1/collections/${collectionId}/documents`, {
      method: "POST",
      body,
    });
  },

  deleteDocument: (id: string) =>
    request<void>(`/api/v1/documents/${id}`, { method: "DELETE" }),

  retryDocument: (id: string) =>
    request<DocumentRecord>(`/api/v1/documents/${id}/retry`, { method: "POST" }),

  ask: (
    question: string,
    collectionId: string,
    options?: { documentIds?: string[]; history?: PriorTurn[] },
  ) =>
    request<AskResponse>("/api/v1/ask", {
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
  return `${API_BASE}/api/v1/documents/${documentId}/file#page=${safePage}`;
}

async function readAskStream(
  body: unknown,
  onEvent: (event: AskStreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(`${API_BASE}/api/v1/ask/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail =
      typeof payload?.detail === "string" ? payload.detail : response.statusText;
    throw new ApiError(detail || "Request failed", response.status);
  }
  if (!response.body) {
    throw new ApiError("The answer stream was empty", 500);
  }

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
      if (event.type === "done" || event.type === "error") finished = true;
    }
  }
  if (!finished) {
    throw new ApiError("The answer stopped before it finished", 500);
  }
}

export { API_BASE };

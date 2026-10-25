export type Collection = {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
  ready_count: number;
  created_at: string;
};

export type StructuredInfo = {
  title: string | null;
  authors: string[];
  creation_date: string | null;
  language: string | null;
  document_type: string | null;
  summary: string | null;
  key_topics: string[];
  headings: string[];
  page_count: number;
  ocr_used: boolean;
};

export type DocumentRecord = {
  id: string;
  collection_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  ocr_pages: number;
  status: "pending" | "processing" | "ready" | "failed" | string;
  error_message: string | null;
  structured_info: StructuredInfo | null;
  created_at: string;
  updated_at: string;
};

export type Citation = {
  n: number;
  document_id: string;
  filename: string;
  page: number;
  snippet: string;
  score: number;
};

export type SearchHit = {
  chunk_id: string;
  document_id: string;
  collection_id: string;
  filename: string;
  page: number;
  text: string;
  score: number;
  rerank_score: number | null;
};

export type AskResponse = {
  question: string;
  answer: string;
  citations: Citation[];
  sources: SearchHit[];
  model: string;
};

export type ChatTurn = {
  id: string;
  question: string;
  answer?: string;
  citations?: Citation[];
  sources?: SearchHit[];
  model?: string;
  error?: string;
  pending?: boolean;
};

export type Health = {
  status: string;
  app: string;
  models: {
    embedding: string;
    embedding_loaded: boolean;
    reranker: string;
    reranker_loaded: boolean;
    llm: string;
    ollama_up: boolean;
  };
  ocr: {
    enabled: boolean;
    tesseract: boolean;
    lang: string;
  };
};

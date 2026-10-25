# AskDoc architecture

How the system ingests PDFs, stores them, and answers with citations.

## 1. System

```mermaid
flowchart LR
    user[User]
    ui[Next.js UI :3000]
    api[FastAPI :8000]
    sqlite[(SQLite<br/>collections + documents)]
    files[(PDF files)]
    chroma[(ChromaDB<br/>chunk embeddings)]
    bge[BGE embed + rerank]
    ocr[Tesseract OCR]
    ollama[Ollama LLM]

    user --> ui
    ui -->|REST /api/v1| api
    api --> sqlite
    api --> files
    api --> chroma
    api --> bge
    api --> ocr
    api --> ollama
```

The browser talks to the UI. The UI calls the API. The API owns files, metadata, vectors, and generation.

## 2. Data schema

SQLite holds **what** was uploaded. Chroma holds **searchable passages** (one vector per chunk).

```mermaid
erDiagram
    collections ||--o{ documents : contains
    documents ||--o{ chunks : indexed_as

    collections {
        string id PK
        string name
        string description
        datetime created_at
    }

    documents {
        string id PK
        string collection_id FK
        string filename
        string stored_path
        int size_bytes
        int page_count
        int chunk_count
        int ocr_pages
        string status
        json structured_info
        string error_message
        datetime created_at
        datetime updated_at
    }

    chunks {
        string chunk_id PK
        string document_id
        string collection_id
        string filename
        int page
        int chunk_index
        string text
        float embedding
    }
```

`chunks` live in Chroma (`askdoc_chunks`), not SQLite. Status on a document is `pending → processing → ready | failed`.

`structured_info` JSON (from PDF metadata, headings, optional LLM):

- title, authors, date, language
- document_type, summary, key_topics, headings
- page_count, ocr_used

## 3. Upload / index

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js
    participant API as FastAPI
    participant FS as Uploads
    participant DB as SQLite
    participant Parse as PyMuPDF + OCR
    participant Emb as BGE embeddings
    participant VS as Chroma

    User->>UI: drop PDFs into a collection
    UI->>API: POST /collections/{id}/documents
    API->>FS: save .pdf
    API->>DB: document status = pending
    API-->>UI: 202 + document ids

    Note over API: background ingestion
    API->>DB: status = processing
    API->>Parse: text per page OCR if page is sparse
    Parse->>API: pages + headings + metadata
    API->>API: chunk by page ~900 chars overlap 150
    API->>Emb: embed each chunk
    Emb-->>API: vectors
    API->>VS: upsert chunk + metadata page filename
    API->>DB: structured_info, chunk_count, status = ready
    UI->>API: poll GET /documents/{id}
```

## 4. Ask with citations

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js
    participant API as FastAPI
    participant Emb as BGE query embed
    participant VS as Chroma
    participant RR as BGE reranker
    participant LLM as Ollama

    User->>UI: question + collection
    UI->>API: POST /ask
    API->>Emb: embed query
    Emb-->>API: query vector
    API->>VS: top 8 chunks cosine filter collection_id
    VS-->>API: passages + page + filename
    API->>RR: cross-encode query vs passages
    RR-->>API: top 6
    API->>LLM: sources 1..n + question
    LLM-->>API: answer with 1 2 markers
    API-->>UI: answer + citations filename page snippet
    UI-->>User: highlighted sources
```

Retrieve many, rerank to a short list, generate only from those passages. Inline `[n]` maps back to the ranked chunk.

## 5. Docker

```mermaid
flowchart TB
    subgraph host [Host]
        browser[Browser]
    end

    subgraph compose [docker compose]
        fe[frontend :3000]
        be[backend :8000]
        oc[ollama :11434]
        init[ollama-init pull model]
        tes[Tesseract in backend image]
    end

    subgraph vols [Volumes]
        vdata[askdoc_data]
        vhf[huggingface]
        voll[ollama]
    end

    browser --> fe
    browser --> be
    fe --> be
    be --> oc
    be --> tes
    init --> oc
    be --> vdata
    be --> vhf
    oc --> voll
```

## API map

| Call | Role |
|------|------|
| `POST /api/v1/collections` | Create a library |
| `POST /api/v1/collections/{id}/documents` | Upload PDFs, start indexing |
| `GET /api/v1/documents/{id}` | Status + structured info |
| `POST /api/v1/search` | Semantic search + rerank, no LLM |
| `POST /api/v1/ask` | RAG answer + citations |
| `GET /api/v1/health` | API, Ollama, OCR |

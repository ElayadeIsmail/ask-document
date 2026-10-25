# AskDoc

Backend for a PFE project: **upload PDFs, extract structured information, search them semantically, and answer questions with source citations.**

Built with **FastAPI**, **uv**, **ChromaDB**, **BGE embeddings/reranking**, **Tesseract OCR**, and **Ollama**.

## What it does

1. Upload a collection of PDF documents.
2. Extract text (with OCR fallback for scanned pages).
3. Pull structured metadata: title, authors, headings, summary, topics.
4. Chunk pages, embed them with `BAAI/bge-small-en-v1.5`, store vectors in ChromaDB.
5. Search with dense retrieval, then rerank with `BAAI/bge-reranker-base`.
6. Answer questions with **Ollama**, citing filename + page.

```text
PDF  →  parse / OCR  →  structure  →  chunk  →  BGE embed  →  Chroma
                                                              ↓
Question → embed → retrieve → BGE rerank → Ollama → answer + citations
```

## Requirements

- Python 3.12 (managed by uv)
- [uv](https://docs.astral.sh/uv/)
- [Ollama](https://ollama.com) with a chat model, e.g. `llama3.2:3b`
- Optional: [Tesseract](https://github.com/tesseract-ocr/tesseract) for scanned PDFs (`eng` + `fra`)

macOS OCR:

```bash
brew install tesseract tesseract-lang
```

To run the API **and** the Next.js UI together, use `docker compose up --build` from the repo root (`../docker-compose.yml`).

## Setup

```bash
cd backend
cp .env.example .env
uv sync
```

Pull an Ollama model (in another terminal):

```bash
ollama pull llama3.2:3b
ollama serve
```

BGE models download from Hugging Face and load in the background when the API starts. `/warmup` still forces a load if that has not finished.

## Run

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend (Next.js, from `../frontend`):

```bash
cd ../frontend
npm install
npm run dev
```

UI: http://localhost:3000 — create a collection, upload PDFs, ask with citations.

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health

Warm up embedding + reranker models:

```bash
curl -X POST http://localhost:8000/api/v1/warmup
```

## Demo flow

```bash
# 1. Create a collection
COLLECTION_ID=$(curl -s -X POST http://localhost:8000/api/v1/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"PFE Demo","description":"Course reports"}' | jq -r .id)

# 2. Upload PDFs (ingestion runs in the background)
curl -X POST "http://localhost:8000/api/v1/collections/$COLLECTION_ID/documents" \
  -F "files=@./samples/sample-internship-report.pdf"

# 3. Wait until status is "ready"
curl "http://localhost:8000/api/v1/collections/$COLLECTION_ID/documents"

# 4. Semantic search
curl -s -X POST http://localhost:8000/api/v1/search \
  -H 'Content-Type: application/json' \
  -d "{\"query\":\"What is the evaluation method?\",\"collection_id\":\"$COLLECTION_ID\"}"

# 5. Ask with citations
curl -s -X POST http://localhost:8000/api/v1/ask \
  -H 'Content-Type: application/json' \
  -d "{\"question\":\"Summarize the main conclusions.\",\"collection_id\":\"$COLLECTION_ID\"}"
```

`POST /api/v1/ask` returns:

- `answer` — generated from retrieved passages
- `citations` — `[n]` mapped to filename, page, snippet
- `sources` — reranked chunks used in the prompt

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/health` | App, models, OCR, Ollama |
| `POST` | `/api/v1/warmup` | Load embedding + reranker |
| `POST` | `/api/v1/collections` | Create a document collection |
| `GET` | `/api/v1/collections` | List collections |
| `POST` | `/api/v1/collections/{id}/documents` | Upload PDFs |
| `GET` | `/api/v1/documents/{id}` | Status + structured info |
| `POST` | `/api/v1/search` | Semantic search + rerank |
| `POST` | `/api/v1/ask` | RAG answer with citations |
| `DELETE` | `/api/v1/documents/{id}` | Remove a document |
| `DELETE` | `/api/v1/collections/{id}` | Remove a collection |

## Project layout

```text
app/
  main.py              FastAPI app, lifespan, CORS
  core/                Settings and errors
  db/                  SQLite models (collections, documents)
  schemas/             Pydantic request/response models
  api/v1/              HTTP routes
  services/
    pdf_parser.py      PyMuPDF page extraction
    ocr.py             Tesseract fallback
    chunking.py        Page-aware chunks
    extractor.py       Structured metadata (+ optional LLM)
    embeddings.py      BGE sentence-transformers
    vectorstore.py     ChromaDB
    reranker.py        BGE cross-encoder
    llm.py             Ollama client
    ingestion.py       Upload pipeline
    rag.py             Retrieve → rerank → generate
```

SQLite stores document records and extracted metadata. ChromaDB stores chunk embeddings for retrieval.

## Configuration

See `.env.example`. Useful knobs:

| Variable | Default | Meaning |
|----------|---------|---------|
| `EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | Dense retriever |
| `RERANKER_MODEL` | `BAAI/bge-reranker-base` | Cross-encoder rerank |
| `OLLAMA_MODEL` | `llama3.2:3b` | Generator |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `900` / `150` | Passage size |
| `RETRIEVE_K` / `RERANK_K` | `8` / `6` | Search depth |
| `OCR_ENABLED` | `false` | Tesseract fallback for scanned pages |
| `OCR_LANG` | `eng+fra` | Tesseract languages |

For French/Arabic-heavy corpora, switch embeddings to a multilingual model such as `BAAI/bge-m3` (slower, stronger).

## Tests

```bash
uv run pytest
```

Chunking tests are offline. Health/collection tests start the API without downloading models.

## Notes for the demo

- Wait for each document `status` to become `ready` before asking questions.
- OCR is off by default. Set `OCR_ENABLED=true` and install Tesseract for scanned PDFs.
- If `/ask` returns 503, start Ollama and confirm `ollama list` includes the configured model.
- `/search` still works without Ollama (retrieval + rerank only).

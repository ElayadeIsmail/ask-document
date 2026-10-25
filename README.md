# AskDoc

PFE project: upload PDFs, extract structured information, search them semantically, and answer questions with source citations.

```text
folio/
  backend/     FastAPI + Chroma + BGE + OCR
  frontend/    Next.js 16 UI
  docker-compose.yml
  ARCHITECTURE.md   schema + ingest/ask graphs
```

How it works (data model, ingest, RAG): [ARCHITECTURE.md](./ARCHITECTURE.md)

## Run everything with Docker

Needs Docker Desktop (or Docker Engine + Compose v2). Stop anything already bound to ports **3000**, **8000**, or **11434**. First start pulls **Ollama**, **llama3.2:3b**, **PyTorch**, and the **BGE** models — several GB. Search models load in the background when the API starts.

```bash
cd folio
cp .env.example .env   # optional
docker compose up --build
```

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API docs | http://localhost:8000/docs |
| Ollama | http://localhost:11434 |

`ollama-init` pulls `${OLLAMA_MODEL:-llama3.2:3b}` once. You can upload PDFs while that finishes; `/ask` works after the model is on disk.

Scanned PDFs need OCR, which is off by default:

```bash
OCR_ENABLED=true docker compose up --build
```

Stop:

```bash
docker compose down
```

Keep indexed docs and models:

```bash
docker compose down   # volumes stay
```

Wipe data:

```bash
docker compose down -v
```

## Local development (without Docker)

**Backend** — Tesseract optional, [Ollama](https://ollama.com) required for answers:

```bash
cd backend
cp .env.example .env
uv sync
ollama pull llama3.2:3b
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

## Stack

- **Ingest:** PyMuPDF + Tesseract OCR fallback
- **Retrieve:** `BAAI/bge-small-en-v1.5` → ChromaDB → `BAAI/bge-reranker-base`
- **Generate:** Ollama (`llama3.2:3b` by default) with filename + page citations

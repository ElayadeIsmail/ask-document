# AskDoc frontend

Next.js 16 app for the AskDoc PFE: upload a PDF collection and ask questions with source citations.

Talks to the FastAPI backend at `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`).

From the repo root, `docker compose up --build` starts this UI, the API, Tesseract OCR, and Ollama.

## Run

From this folder:

```bash
npm install
cp .env.example .env.local
npm run dev
```

In another terminal, start the backend:

```bash
cd ../backend
uv run uvicorn app.main:app --reload --port 8000
```

Open http://localhost:3000

## Demo

1. Create a collection in the left rail.
2. Upload PDFs (try `../backend/samples/sample-internship-report.pdf`).
3. Wait until a document shows **ready**.
4. Ask a question. Citations link to filename + page.

Cited answers need Ollama running on the backend (`ollama serve` and `ollama pull llama3.2:3b`).

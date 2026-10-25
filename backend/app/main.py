from __future__ import annotations

import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.exceptions import AskDocError
from app.db.session import init_db
from app.services.embeddings import EmbeddingService
from app.services.ingestion import IngestionService
from app.services.llm import LLMService
from app.services.rag import RAGService
from app.services.reranker import RerankerService
from app.services.vectorstore import VectorStore

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
os.environ.setdefault("CHROMA_TELEMETRY_DISABLED", "1")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("askdoc")


def _resume_incomplete(ingestion: IngestionService) -> None:
    from sqlalchemy import select

    from app.db.models import Document, DocumentStatus
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        ids = list(
            db.scalars(
                select(Document.id).where(
                    Document.status.in_(
                        [DocumentStatus.pending.value, DocumentStatus.processing.value]
                    )
                )
            ).all()
        )
    finally:
        db.close()
    if not ids:
        return
    logger.info("Resuming %s unfinished document(s)", len(ids))
    for document_id in ids:
        ingestion.ingest_document(document_id)


def _preload_search_models(embeddings: EmbeddingService, reranker: RerankerService) -> None:
    try:
        logger.info("Preloading embedding and reranker models")
        embeddings.load()
        reranker.load()
        logger.info("Search models ready")
    except Exception:
        logger.exception("Search model preload failed; the first search will retry")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.resolved_data_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    init_db()

    embeddings = EmbeddingService(settings)
    vectorstore = VectorStore(settings)
    reranker = RerankerService(settings)
    llm = LLMService(settings)
    ingestion = IngestionService(settings, embeddings, vectorstore, llm)
    rag = RAGService(settings, embeddings, vectorstore, reranker, llm)

    app.state.settings = settings
    app.state.embeddings = embeddings
    app.state.vectorstore = vectorstore
    app.state.reranker = reranker
    app.state.llm = llm
    app.state.ingestion = ingestion
    app.state.rag = rag
    if settings.preload_models:
        threading.Thread(
            target=_preload_search_models,
            args=(embeddings, reranker),
            name="model-preload",
            daemon=True,
        ).start()
        logger.info("AskDoc backend ready (search models loading in the background)")
    else:
        logger.info("AskDoc backend ready (search models load on first use)")
    if settings.resume_on_startup:
        threading.Thread(
            target=_resume_incomplete,
            args=(ingestion,),
            name="resume-ingestion",
            daemon=True,
        ).start()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "Upload a collection of PDFs, extract structured information, "
            "search them semantically, and ask questions with source citations."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AskDocError)
    async def askdoc_error_handler(_request: Request, exc: AskDocError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    app.include_router(api_router)

    @app.get("/", tags=["health"])
    def root() -> dict:
        return {
            "name": settings.app_name,
            "docs": "/docs",
            "health": "/api/v1/health",
        }

    return app


app = create_app()

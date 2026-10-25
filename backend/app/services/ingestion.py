from __future__ import annotations

import logging
import threading
from pathlib import Path

from app.core.config import Settings
from app.db.models import Document, DocumentStatus
from app.db.session import SessionLocal
from app.services.chunking import chunk_document
from app.services.embeddings import EmbeddingService
from app.services.extractor import extract_structured_info
from app.services.llm import LLMService
from app.services.pdf_parser import parse_pdf
from app.services.vectorstore import VectorStore

logger = logging.getLogger(__name__)


class IngestionService:
    def __init__(
        self,
        settings: Settings,
        embeddings: EmbeddingService,
        vectorstore: VectorStore,
        llm: LLMService,
    ) -> None:
        self._settings = settings
        self._embeddings = embeddings
        self._vectorstore = vectorstore
        self._llm = llm
        self._inflight: set[str] = set()
        self._inflight_lock = threading.Lock()

    def ingest_document(self, document_id: str) -> None:
        with self._inflight_lock:
            if document_id in self._inflight:
                logger.info("Ingestion already running for %s", document_id)
                return
            self._inflight.add(document_id)
        db = SessionLocal()
        try:
            document = db.get(Document, document_id)
            if document is None:
                logger.error("Document %s disappeared before ingestion", document_id)
                return
            document.status = DocumentStatus.processing.value
            document.error_message = None
            db.commit()

            path = Path(document.stored_path)
            try:
                self._vectorstore.delete_document(document.id)
            except Exception:
                logger.exception("Could not clear old chunks for %s", document.id)
            parsed = parse_pdf(path, self._settings)
            chunks = chunk_document(
                parsed,
                chunk_size=self._settings.chunk_size,
                overlap=self._settings.chunk_overlap,
            )
            if not chunks:
                raise ValueError("No extractable text found in this PDF.")

            embeddings = self._embeddings.embed_documents([chunk.text for chunk in chunks])
            self._vectorstore.upsert_chunks(
                document_id=document.id,
                collection_id=document.collection_id,
                filename=document.filename,
                chunks=chunks,
                embeddings=embeddings,
            )
            structured = extract_structured_info(parsed, llm=self._llm)

            document.page_count = parsed.page_count
            document.chunk_count = len(chunks)
            document.ocr_pages = parsed.ocr_page_count
            document.structured_info = structured.model_dump()
            document.status = DocumentStatus.ready.value
            db.commit()
            logger.info("Ingested %s (%s chunks)", document.filename, len(chunks))
        except Exception as exc:
            logger.exception("Ingestion failed for %s", document_id)
            db.rollback()
            document = db.get(Document, document_id)
            if document is not None:
                document.status = DocumentStatus.failed.value
                document.error_message = str(exc)
                db.commit()
        finally:
            db.close()
            with self._inflight_lock:
                self._inflight.discard(document_id)

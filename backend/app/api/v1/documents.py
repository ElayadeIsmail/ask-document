from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_ingestion, get_settings_dep, get_vectorstore
from app.api.serializers import to_document_out
from app.core.config import Settings
from app.core.exceptions import NotFoundError
from app.db.models import Document, DocumentStatus
from app.db.session import get_db
from app.schemas.document import DocumentOut
from app.services.ingestion import IngestionService
from app.services.vectorstore import VectorStore

_RETRYABLE = {
    DocumentStatus.failed.value,
    DocumentStatus.pending.value,
    DocumentStatus.processing.value,
}

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db)) -> DocumentOut:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    return to_document_out(document)


@router.get("/{document_id}/file")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> FileResponse:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    stored = Path(document.stored_path).resolve()
    root = settings.upload_dir.resolve()
    if root != stored and root not in stored.parents:
        raise NotFoundError("Document file is missing")
    if not stored.is_file():
        raise NotFoundError("Document file is missing")
    return FileResponse(
        stored,
        media_type="application/pdf",
        filename=document.filename,
        content_disposition_type="inline",
    )


@router.post("/{document_id}/retry", response_model=DocumentOut)
def retry_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ingestion: IngestionService = Depends(get_ingestion),
) -> DocumentOut:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    if document.status not in _RETRYABLE:
        raise HTTPException(status_code=409, detail="This document is already indexed")
    document.status = DocumentStatus.pending.value
    document.error_message = None
    db.commit()
    db.refresh(document)
    background_tasks.add_task(ingestion.ingest_document, document.id)
    return to_document_out(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    vectorstore: VectorStore = Depends(get_vectorstore),
) -> None:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    vectorstore.delete_document(document_id)
    stored = Path(document.stored_path)
    if stored.exists():
        stored.unlink()
    db.delete(document)
    db.commit()

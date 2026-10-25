from __future__ import annotations

import shutil
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_ingestion, get_settings_dep, get_vectorstore
from app.api.serializers import to_collection_out, to_document_out
from app.core.config import Settings
from app.core.exceptions import NotFoundError
from app.db.models import Collection, Document, DocumentStatus
from app.db.session import get_db
from app.schemas.collection import CollectionCreate, CollectionOut
from app.schemas.document import DocumentOut
from app.services.ingestion import IngestionService
from app.services.vectorstore import VectorStore

router = APIRouter(prefix="/collections", tags=["collections"])


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection(payload: CollectionCreate, db: Session = Depends(get_db)) -> CollectionOut:
    collection = Collection(
        id=str(uuid.uuid4()),
        name=payload.name.strip(),
        description=payload.description,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return to_collection_out(collection)


@router.get("", response_model=list[CollectionOut])
def list_collections(db: Session = Depends(get_db)) -> list[CollectionOut]:
    collections = db.scalars(
        select(Collection)
        .options(selectinload(Collection.documents))
        .order_by(Collection.created_at.desc())
    ).all()
    return [to_collection_out(item) for item in collections]


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(collection_id: str, db: Session = Depends(get_db)) -> CollectionOut:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise NotFoundError("Collection not found")
    return to_collection_out(collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: str,
    db: Session = Depends(get_db),
    vectorstore: VectorStore = Depends(get_vectorstore),
    settings: Settings = Depends(get_settings_dep),
) -> None:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise NotFoundError("Collection not found")
    vectorstore.delete_collection(collection_id)
    folder = settings.upload_dir / collection_id
    if folder.exists():
        shutil.rmtree(folder, ignore_errors=True)
    db.delete(collection)
    db.commit()


@router.get("/{collection_id}/documents", response_model=list[DocumentOut])
def list_collection_documents(
    collection_id: str, db: Session = Depends(get_db)
) -> list[DocumentOut]:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise NotFoundError("Collection not found")
    return [to_document_out(doc) for doc in collection.documents]


@router.post(
    "/{collection_id}/documents",
    response_model=list[DocumentOut],
    status_code=status.HTTP_202_ACCEPTED,
)
def upload_documents(
    collection_id: str,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(..., description="One or more PDF files"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
    ingestion: IngestionService = Depends(get_ingestion),
) -> list[DocumentOut]:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise NotFoundError("Collection not found")
    if not files:
        raise HTTPException(status_code=400, detail="At least one PDF is required")

    created: list[Document] = []
    for upload in files:
        filename = upload.filename or "document.pdf"
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{filename} is not a PDF")
        payload = upload.file.read()
        if len(payload) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"{filename} exceeds the {settings.max_upload_mb} MB limit",
            )
        document_id = str(uuid.uuid4())
        target_dir = settings.upload_dir / collection_id
        target_dir.mkdir(parents=True, exist_ok=True)
        stored_path = target_dir / f"{document_id}.pdf"
        stored_path.write_bytes(payload)

        document = Document(
            id=document_id,
            collection_id=collection_id,
            filename=filename,
            stored_path=str(stored_path),
            content_type=upload.content_type or "application/pdf",
            size_bytes=len(payload),
            status=DocumentStatus.pending.value,
        )
        db.add(document)
        created.append(document)

    db.commit()
    for document in created:
        db.refresh(document)
        background_tasks.add_task(ingestion.ingest_document, document.id)

    return [to_document_out(document) for document in created]

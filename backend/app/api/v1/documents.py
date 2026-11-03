from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    bearer_scheme,
    get_current_user,
    get_ingestion,
    get_rag,
    get_settings_dep,
    get_vectorstore,
    user_from_token,
)
from app.api.serializers import to_chat_message, to_document_out, to_share_out
from app.api.stream import stream_answer
from app.core.config import Settings
from app.core.exceptions import ConflictError, NotFoundError
from app.db.models import (
    DocumentShare,
    DocumentStatus,
    ShareStatus,
    User,
)
from app.db.session import get_db
from app.schemas.chat import ChatCreate, ChatMessageOut
from app.schemas.document import DocumentOut
from app.schemas.qa import AskRequest, AskResponse
from app.schemas.share import ShareCreate, ShareOut
from app.services.access import can_post_chat, require_document
from app.services.chatlog import load_messages, persist_exchange, prior_turns, save_exchange
from app.services.ingestion import IngestionService
from app.services.rag import RAGService
from app.services.vectorstore import VectorStore

_RETRYABLE = {
    DocumentStatus.failed.value,
    DocumentStatus.pending.value,
    DocumentStatus.processing.value,
}

router = APIRouter(prefix="/documents", tags=["documents"])


def _thread(db: Session, document_id: str) -> list[ChatMessageOut]:
    return [to_chat_message(message) for message in load_messages(db, document_id=document_id)]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    document = require_document(db, user, document_id)
    return to_document_out(document)


@router.get("/{document_id}/file")
def download_document(
    document_id: str,
    access_token: str | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> FileResponse:
    token = credentials.credentials if credentials is not None else access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = user_from_token(token, db, settings)
    document = require_document(db, user, document_id)
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
    user: User = Depends(get_current_user),
) -> DocumentOut:
    document = require_document(db, user, document_id, write=True)
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
    user: User = Depends(get_current_user),
) -> None:
    document = require_document(db, user, document_id, write=True)
    vectorstore.delete_document(document_id)
    stored = Path(document.stored_path)
    if stored.exists():
        stored.unlink()
    db.delete(document)
    db.commit()


@router.get("/{document_id}/shares", response_model=list[ShareOut])
def list_document_shares(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ShareOut]:
    document = require_document(db, user, document_id, write=True)
    shares = db.scalars(
        select(DocumentShare)
        .where(DocumentShare.document_id == document.id)
        .options(
            selectinload(DocumentShare.document),
            selectinload(DocumentShare.sender),
            selectinload(DocumentShare.recipient),
        )
        .order_by(DocumentShare.created_at.desc())
    ).all()
    return [to_share_out(share) for share in shares]


@router.post("/{document_id}/shares", response_model=ShareOut, status_code=status.HTTP_201_CREATED)
def create_document_share(
    document_id: str,
    payload: ShareCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareOut:
    document = require_document(db, user, document_id, write=True)
    username = payload.username.strip().lower()
    recipient = db.scalar(select(User).where(User.username == username))
    if recipient is None:
        raise NotFoundError("User not found")
    if recipient.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot share a PDF with yourself")

    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == document.id,
            DocumentShare.to_user_id == recipient.id,
        )
    )
    if share is None:
        share = DocumentShare(
            id=str(uuid.uuid4()),
            document_id=document.id,
            from_user_id=user.id,
            to_user_id=recipient.id,
            status=ShareStatus.pending.value,
        )
        db.add(share)
    elif share.status == ShareStatus.accepted.value:
        raise ConflictError("This PDF is already shared with that user")
    elif share.status == ShareStatus.pending.value:
        raise ConflictError("This user already has a pending invite")
    else:
        share.status = ShareStatus.pending.value
        share.from_user_id = user.id
        share.responded_at = None
        share.created_at = datetime.now(UTC)

    db.commit()
    db.refresh(share)
    share = db.scalar(
        select(DocumentShare)
        .where(DocumentShare.id == share.id)
        .options(
            selectinload(DocumentShare.document),
            selectinload(DocumentShare.sender),
            selectinload(DocumentShare.recipient),
        )
    )
    assert share is not None
    return to_share_out(share)


@router.get("/{document_id}/messages", response_model=list[ChatMessageOut])
def list_messages(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ChatMessageOut]:
    document = require_document(db, user, document_id)
    return _thread(db, document.id)


@router.post("/{document_id}/messages", response_model=list[ChatMessageOut])
def post_message(
    document_id: str,
    payload: ChatCreate,
    db: Session = Depends(get_db),
    rag: RAGService = Depends(get_rag),
    user: User = Depends(get_current_user),
) -> list[ChatMessageOut]:
    document = require_document(db, user, document_id)
    if not can_post_chat(db, user, document):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can read this chat but not send messages",
        )
    question = payload.question.strip()
    existing = load_messages(db, document_id=document.id)
    result = rag.ask(
        AskRequest(
            question=question,
            collection_id=document.collection_id,
            document_ids=[document.id],
            history=prior_turns(existing),
        )
    )
    save_exchange(
        db,
        user_id=user.id,
        document_id=document.id,
        question=question,
        answer=result.answer,
        citations=[item.model_dump() for item in result.citations],
    )
    db.commit()
    return _thread(db, document.id)


@router.post("/{document_id}/messages/stream")
def stream_message(
    document_id: str,
    payload: ChatCreate,
    db: Session = Depends(get_db),
    rag: RAGService = Depends(get_rag),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    document = require_document(db, user, document_id)
    if not can_post_chat(db, user, document):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can read this chat but not send messages",
        )
    question = payload.question.strip()
    request = AskRequest(
        question=question,
        collection_id=document.collection_id,
        document_ids=[document.id],
        history=prior_turns(load_messages(db, document_id=document.id)),
    )
    owner_id = user.id
    saved_document_id = document.id

    def save(result: AskResponse) -> None:
        persist_exchange(
            user_id=owner_id,
            document_id=saved_document_id,
            question=question,
            answer=result.answer,
            citations=[item.model_dump() for item in result.citations],
        )

    return stream_answer(rag, request, save)

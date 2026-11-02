from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import ChatMessage, ChatRole
from app.db.session import SessionLocal
from app.schemas.qa import PriorTurn


def prior_turns(messages: list[ChatMessage]) -> list[PriorTurn]:
    pairs: list[PriorTurn] = []
    question: str | None = None
    for message in messages:
        if message.role == ChatRole.user.value:
            question = message.content
        elif message.role == ChatRole.assistant.value and question and message.content.strip():
            pairs.append(PriorTurn(question=question, answer=message.content))
            question = None
    return pairs[-6:]


def load_messages(
    db: Session,
    *,
    document_id: str | None = None,
    collection_id: str | None = None,
) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.author))
        .order_by(ChatMessage.created_at.asc())
    )
    if document_id is not None:
        stmt = stmt.where(ChatMessage.document_id == document_id)
    else:
        stmt = stmt.where(ChatMessage.collection_id == collection_id)
    return list(db.scalars(stmt).all())


def save_exchange(
    db: Session,
    *,
    user_id: str,
    question: str,
    answer: str,
    citations: list[dict],
    document_id: str | None = None,
    collection_id: str | None = None,
) -> None:
    if (document_id is None) == (collection_id is None):
        raise ValueError("A chat message belongs to a document or a collection")
    asked_at = datetime.now(UTC)
    db.add(
        ChatMessage(
            id=str(uuid.uuid4()),
            document_id=document_id,
            collection_id=collection_id,
            user_id=user_id,
            role=ChatRole.user.value,
            content=question,
            created_at=asked_at,
        )
    )
    db.add(
        ChatMessage(
            id=str(uuid.uuid4()),
            document_id=document_id,
            collection_id=collection_id,
            user_id=user_id,
            role=ChatRole.assistant.value,
            content=answer,
            citations=citations or None,
            created_at=asked_at + timedelta(milliseconds=1),
        )
    )


def persist_exchange(**kwargs) -> None:
    db = SessionLocal()
    try:
        save_exchange(db, **kwargs)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

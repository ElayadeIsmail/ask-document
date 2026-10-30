from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.api.serializers import to_document_out, to_share_out
from app.core.exceptions import ConflictError, NotFoundError
from app.db.models import Document, DocumentShare, ShareStatus, User
from app.db.session import get_db
from app.schemas.share import SharedDocumentOut, ShareOut

router = APIRouter(prefix="/shares", tags=["shares"])

_SHARE_LOAD = (
    selectinload(DocumentShare.document),
    selectinload(DocumentShare.sender),
    selectinload(DocumentShare.recipient),
)


def _recipient_share(db: Session, user: User, share_id: str) -> DocumentShare:
    share = db.scalar(
        select(DocumentShare)
        .where(DocumentShare.id == share_id)
        .options(*_SHARE_LOAD)
    )
    if share is None or share.to_user_id != user.id:
        raise NotFoundError("Invite not found")
    return share


@router.get("/incoming", response_model=list[ShareOut])
def list_incoming(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ShareOut]:
    shares = db.scalars(
        select(DocumentShare)
        .where(
            DocumentShare.to_user_id == user.id,
            DocumentShare.status == ShareStatus.pending.value,
        )
        .options(*_SHARE_LOAD)
        .order_by(DocumentShare.created_at.desc())
    ).all()
    return [to_share_out(share) for share in shares]


@router.get("/accepted", response_model=list[SharedDocumentOut])
def list_accepted(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SharedDocumentOut]:
    shares = db.scalars(
        select(DocumentShare)
        .where(
            DocumentShare.to_user_id == user.id,
            DocumentShare.status == ShareStatus.accepted.value,
        )
        .options(
            selectinload(DocumentShare.document).selectinload(Document.collection),
            selectinload(DocumentShare.sender),
            selectinload(DocumentShare.recipient),
        )
        .order_by(DocumentShare.created_at.desc())
    ).all()
    shared: list[SharedDocumentOut] = []
    for share in shares:
        document = to_document_out(share.document)
        shared.append(
            SharedDocumentOut(
                **document.model_dump(),
                share_id=share.id,
                shared_by=share.sender.username,
            )
        )
    return shared


@router.post("/{share_id}/accept", response_model=ShareOut)
def accept_share(
    share_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareOut:
    share = _recipient_share(db, user, share_id)
    if share.status != ShareStatus.pending.value:
        raise ConflictError("This invite was already answered")
    share.status = ShareStatus.accepted.value
    share.responded_at = datetime.now(UTC)
    db.commit()
    db.refresh(share)
    return to_share_out(share)


@router.post("/{share_id}/decline", response_model=ShareOut)
def decline_share(
    share_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareOut:
    share = _recipient_share(db, user, share_id)
    if share.status != ShareStatus.pending.value:
        raise ConflictError("This invite was already answered")
    share.status = ShareStatus.declined.value
    share.responded_at = datetime.now(UTC)
    db.commit()
    db.refresh(share)
    return to_share_out(share)

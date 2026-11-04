from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_admin
from app.db.models import Collection, User
from app.db.session import get_db
from app.schemas.auth import AdminDocumentOut, AdminUserOut, UserPublic

router = APIRouter(tags=["users"])


@router.get("/users", response_model=list[UserPublic])
def search_users(
    q: str = Query(min_length=1, max_length=32),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[UserPublic]:
    term = q.strip().lower().replace("%", "").replace("_", "")
    if not term:
        return []
    matches = db.scalars(
        select(User)
        .where(User.username.contains(term), User.id != user.id)
        .order_by(User.username.asc())
        .limit(8)
    ).all()
    return [UserPublic(id=match.id, username=match.username) for match in matches]


@router.get("/admin/users", response_model=list[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[AdminUserOut]:
    users = db.scalars(
        select(User)
        .options(selectinload(User.collections).selectinload(Collection.documents))
        .order_by(User.created_at.asc())
    ).all()
    listed: list[AdminUserOut] = []
    for account in users:
        documents: list[AdminDocumentOut] = []
        for collection in account.collections:
            for document in collection.documents:
                documents.append(
                    AdminDocumentOut(
                        id=document.id,
                        filename=document.filename,
                        status=document.status,
                        collection_id=collection.id,
                        collection_name=collection.name,
                        page_count=document.page_count,
                        created_at=document.created_at,
                    )
                )
        documents.sort(key=lambda item: item.created_at, reverse=True)
        listed.append(
            AdminUserOut(
                id=account.id,
                email=account.email,
                username=account.username,
                role=account.role,
                created_at=account.created_at,
                documents=documents,
            )
        )
    return listed

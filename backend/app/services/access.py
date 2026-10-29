from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AskDocError, NotFoundError
from app.db.models import Collection, Document, DocumentShare, ShareStatus, User, UserRole


def load_collection(db: Session, collection_id: str) -> Collection:
    collection = db.get(Collection, collection_id)
    if collection is None:
        raise NotFoundError("Collection not found")
    return collection


def assert_collection_owner(user: User, collection: Collection) -> None:
    if collection.owner_id != user.id:
        raise NotFoundError("Collection not found")


def owns_document(user: User, document: Document) -> bool:
    collection = document.collection
    return collection is not None and collection.owner_id == user.id


def accepted_share(db: Session, user: User, document: Document) -> DocumentShare | None:
    return db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == document.id,
            DocumentShare.to_user_id == user.id,
            DocumentShare.status == ShareStatus.accepted.value,
        )
    )


def can_read_document(db: Session, user: User, document: Document) -> bool:
    if user.role == UserRole.admin.value:
        return True
    if owns_document(user, document):
        return True
    return accepted_share(db, user, document) is not None


def can_post_chat(db: Session, user: User, document: Document) -> bool:
    if owns_document(user, document):
        return True
    return accepted_share(db, user, document) is not None


def require_document(db: Session, user: User, document_id: str, *, write: bool = False) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise NotFoundError("Document not found")
    if write:
        if not owns_document(user, document):
            raise NotFoundError("Document not found")
        return document
    if not can_read_document(db, user, document):
        raise NotFoundError("Document not found")
    return document


def authorize_retrieval(
    db: Session,
    user: User,
    collection_id: str | None,
    document_ids: list[str] | None,
) -> None:
    if not collection_id and not document_ids:
        raise AskDocError("Choose a collection or a document", status_code=400)
    if collection_id:
        collection = load_collection(db, collection_id)
        if collection.owner_id != user.id and user.role != UserRole.admin.value:
            raise NotFoundError("Collection not found")
    if not document_ids:
        return
    for document_id in document_ids:
        document = db.get(Document, document_id)
        if document is None or not can_read_document(db, user, document):
            raise NotFoundError("Document not found")
        if collection_id and document.collection_id != collection_id:
            raise AskDocError("Document is not in this collection", status_code=400)

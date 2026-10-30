from app.db.models import ChatMessage, Collection, Document, DocumentShare, DocumentStatus
from app.schemas.chat import ChatMessageOut
from app.schemas.collection import CollectionOut
from app.schemas.document import DocumentOut, StructuredInfo
from app.schemas.qa import Citation
from app.schemas.share import ShareOut


def to_collection_out(collection: Collection) -> CollectionOut:
    docs = collection.documents or []
    return CollectionOut(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        document_count=len(docs),
        ready_count=sum(1 for doc in docs if doc.status == DocumentStatus.ready.value),
        created_at=collection.created_at,
    )


def to_document_out(document: Document) -> DocumentOut:
    structured = None
    if document.structured_info:
        structured = StructuredInfo.model_validate(document.structured_info)
    return DocumentOut(
        id=document.id,
        collection_id=document.collection_id,
        filename=document.filename,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        page_count=document.page_count,
        chunk_count=document.chunk_count,
        ocr_pages=document.ocr_pages,
        status=document.status,
        error_message=document.error_message,
        structured_info=structured,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def to_share_out(share: DocumentShare) -> ShareOut:
    return ShareOut(
        id=share.id,
        document_id=share.document_id,
        filename=share.document.filename,
        from_username=share.sender.username,
        to_username=share.recipient.username,
        status=share.status,
        created_at=share.created_at,
    )


def to_chat_message(message: ChatMessage) -> ChatMessageOut:
    citations = None
    if message.citations:
        citations = [Citation.model_validate(item) for item in message.citations]
    return ChatMessageOut(
        id=message.id,
        document_id=message.document_id,
        collection_id=message.collection_id,
        user_id=message.user_id,
        username=message.author.username,
        role=message.role,
        content=message.content,
        citations=citations,
        created_at=message.created_at,
    )

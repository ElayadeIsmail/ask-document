from app.db.models import Collection, Document, DocumentStatus
from app.schemas.collection import CollectionOut
from app.schemas.document import DocumentOut, StructuredInfo


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

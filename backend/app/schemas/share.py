from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.document import DocumentOut


class ShareCreate(BaseModel):
    username: str = Field(min_length=2, max_length=32)


class ShareOut(BaseModel):
    id: str
    document_id: str
    filename: str
    from_username: str
    to_username: str
    status: str
    created_at: datetime


class SharedDocumentOut(DocumentOut):
    share_id: str
    shared_by: str

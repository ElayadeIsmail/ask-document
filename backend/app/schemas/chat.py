from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.qa import Citation


class ChatCreate(BaseModel):
    question: str = Field(min_length=1, max_length=4000)


class CollectionChatCreate(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_ids: list[str] | None = None


class ChatMessageOut(BaseModel):
    id: str
    document_id: str | None = None
    collection_id: str | None = None
    user_id: str
    username: str
    role: str
    content: str
    citations: list[Citation] | None = None
    created_at: datetime

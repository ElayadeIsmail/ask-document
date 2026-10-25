from datetime import datetime

from pydantic import BaseModel, Field


class StructuredInfo(BaseModel):
    title: str | None = None
    authors: list[str] = Field(default_factory=list)
    creation_date: str | None = None
    language: str | None = None
    document_type: str | None = None
    summary: str | None = None
    key_topics: list[str] = Field(default_factory=list)
    headings: list[str] = Field(default_factory=list)
    page_count: int = 0
    ocr_used: bool = False


class DocumentOut(BaseModel):
    id: str
    collection_id: str
    filename: str
    content_type: str
    size_bytes: int
    page_count: int
    chunk_count: int
    ocr_pages: int
    status: str
    error_message: str | None = None
    structured_info: StructuredInfo | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

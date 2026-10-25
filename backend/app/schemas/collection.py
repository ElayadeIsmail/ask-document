from datetime import datetime

from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class CollectionOut(BaseModel):
    id: str
    name: str
    description: str | None
    document_count: int = 0
    ready_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}

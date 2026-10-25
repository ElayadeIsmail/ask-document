from pydantic import BaseModel, Field

from app.schemas.search import SearchHit


class PriorTurn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    answer: str = Field(min_length=1, max_length=8000)


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    collection_id: str | None = None
    document_ids: list[str] | None = None
    history: list[PriorTurn] = Field(default_factory=list, max_length=6)
    top_k: int | None = Field(default=None, ge=1, le=20)
    temperature: float = Field(default=0.1, ge=0.0, le=1.0)


class Citation(BaseModel):
    n: int
    document_id: str
    filename: str
    page: int
    snippet: str
    score: float


class AskResponse(BaseModel):
    question: str
    answer: str
    citations: list[Citation]
    sources: list[SearchHit]
    model: str

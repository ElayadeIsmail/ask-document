from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    collection_id: str | None = None
    document_ids: list[str] | None = None
    top_k: int | None = Field(default=None, ge=1, le=50)


class SearchHit(BaseModel):
    chunk_id: str
    document_id: str
    collection_id: str
    filename: str
    page: int
    text: str
    score: float
    rerank_score: float | None = None


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]

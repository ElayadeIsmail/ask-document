from fastapi import APIRouter, Depends

from app.api.deps import get_rag
from app.schemas.search import SearchRequest, SearchResponse
from app.services.rag import RAGService

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
def semantic_search(payload: SearchRequest, rag: RAGService = Depends(get_rag)) -> SearchResponse:
    return rag.search(payload, rerank=True)

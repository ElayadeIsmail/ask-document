from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_rag
from app.db.models import User
from app.db.session import get_db
from app.schemas.search import SearchRequest, SearchResponse
from app.services.access import authorize_retrieval
from app.services.rag import RAGService

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
def semantic_search(
    payload: SearchRequest,
    rag: RAGService = Depends(get_rag),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SearchResponse:
    authorize_retrieval(db, user, payload.collection_id, payload.document_ids)
    return rag.search(payload, rerank=True)

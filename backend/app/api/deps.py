import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import decode_access_token
from app.db.models import User, UserRole
from app.db.session import get_db
from app.services.embeddings import EmbeddingService
from app.services.ingestion import IngestionService
from app.services.llm import LLMService
from app.services.rag import RAGService
from app.services.reranker import RerankerService
from app.services.vectorstore import VectorStore

bearer_scheme = HTTPBearer(auto_error=False)


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_embeddings(request: Request) -> EmbeddingService:
    return request.app.state.embeddings


def get_vectorstore(request: Request) -> VectorStore:
    return request.app.state.vectorstore


def get_reranker(request: Request) -> RerankerService:
    return request.app.state.reranker


def get_llm(request: Request) -> LLMService:
    return request.app.state.llm


def get_ingestion(request: Request) -> IngestionService:
    return request.app.state.ingestion


def get_rag(request: Request) -> RAGService:
    return request.app.state.rag


def user_from_token(token: str, db: Session, settings: Settings) -> User:
    try:
        user_id = decode_access_token(token, settings.jwt_secret)
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings_dep),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_from_token(credentials.credentials, db, settings)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user

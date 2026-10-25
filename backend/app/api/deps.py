from fastapi import Request

from app.core.config import Settings
from app.services.embeddings import EmbeddingService
from app.services.ingestion import IngestionService
from app.services.llm import LLMService
from app.services.rag import RAGService
from app.services.reranker import RerankerService
from app.services.vectorstore import VectorStore


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

from fastapi import APIRouter, Request

from app.services.embeddings import EmbeddingService
from app.services.llm import LLMService
from app.services.ocr import tesseract_available
from app.services.reranker import RerankerService

router = APIRouter(tags=["health"])


@router.get("/health")
def health(request: Request) -> dict:
    settings = request.app.state.settings
    embeddings: EmbeddingService = request.app.state.embeddings
    reranker: RerankerService = request.app.state.reranker
    llm: LLMService = request.app.state.llm
    return {
        "status": "ok",
        "app": settings.app_name,
        "models": {
            "embedding": settings.embedding_model,
            "embedding_loaded": embeddings.loaded,
            "reranker": settings.reranker_model,
            "reranker_loaded": reranker.loaded,
            "llm": settings.ollama_model,
            "ollama_up": llm.available(),
        },
        "ocr": {
            "enabled": settings.ocr_enabled,
            "tesseract": tesseract_available(),
            "lang": settings.ocr_lang,
        },
    }


@router.post("/warmup")
def warmup(request: Request) -> dict:
    embeddings: EmbeddingService = request.app.state.embeddings
    reranker: RerankerService = request.app.state.reranker
    embeddings.load()
    reranker.load()
    return {
        "embedding_loaded": embeddings.loaded,
        "reranker_loaded": reranker.loaded,
        "ollama_up": request.app.state.llm.available(),
    }

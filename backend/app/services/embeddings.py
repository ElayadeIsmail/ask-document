from __future__ import annotations

import logging
import threading

from app.core.config import Settings

logger = logging.getLogger(__name__)

# BGE retrieval models expect this instruction on queries, not on passages.
_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


class EmbeddingService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model = None
        self._lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._settings.embedding_model

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            from sentence_transformers import SentenceTransformer

            device = _select_device()
            logger.info("Loading embedding model %s on %s", self.model_name, device)
            self._model = SentenceTransformer(self.model_name, device=device)
            self._model.encode(["warmup"], normalize_embeddings=True, show_progress_bar=False)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.load()
        vectors = self._model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )
        return vectors.tolist()

    def embed_query(self, query: str) -> list[float]:
        self.load()
        prefixed = query if query.startswith(_QUERY_PREFIX) else f"{_QUERY_PREFIX}{query}"
        vector = self._model.encode(prefixed, normalize_embeddings=True, show_progress_bar=False)
        return vector.tolist()


def _select_device() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"

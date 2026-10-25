from __future__ import annotations

import logging
import threading

from app.core.config import Settings
from app.schemas.search import SearchHit

logger = logging.getLogger(__name__)


class RerankerService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model = None
        self._lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._settings.reranker_model

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            from sentence_transformers import CrossEncoder

            logger.info("Loading reranker %s", self.model_name)
            self._model = CrossEncoder(self.model_name)
            self._model.predict([("warmup", "warmup")], show_progress_bar=False)

    def rerank(self, query: str, hits: list[SearchHit], top_k: int) -> list[SearchHit]:
        if not hits:
            return []
        self.load()
        pairs = [(query, hit.text) for hit in hits]
        scores = self._model.predict(pairs, show_progress_bar=False)
        ranked = []
        for hit, score in zip(hits, scores, strict=True):
            ranked.append(
                hit.model_copy(update={"rerank_score": float(score), "score": float(score)})
            )
        ranked.sort(key=lambda item: item.score, reverse=True)
        return ranked[:top_k]

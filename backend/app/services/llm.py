from __future__ import annotations

import logging

import httpx
import ollama

from app.core.config import Settings
from app.core.exceptions import DependencyUnavailableError

logger = logging.getLogger(__name__)


def _chunk_text(part: object) -> str:
    if isinstance(part, dict):
        message = part.get("message") or {}
        if isinstance(message, dict):
            return message.get("content") or ""
        return ""
    message = getattr(part, "message", None)
    return getattr(message, "content", None) or ""


class LLMService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = ollama.Client(host=settings.ollama_host, timeout=settings.ollama_timeout_s)

    @property
    def model_name(self) -> str:
        return self._settings.ollama_model

    def available(self) -> bool:
        try:
            with httpx.Client(timeout=3.0) as client:
                response = client.get(f"{self._settings.ollama_host.rstrip('/')}/api/tags")
            return response.status_code == 200
        except Exception:
            return False

    def generate(self, *, system: str, prompt: str, temperature: float = 0.1) -> str:
        if not self.available():
            raise DependencyUnavailableError(
                "Ollama is not reachable. Start it with `ollama serve` and pull a model "
                f"(default: `ollama pull {self.model_name}`)."
            )
        try:
            response = self._client.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                options={"temperature": temperature},
            )
        except Exception as exc:
            logger.exception("Ollama generation failed")
            raise DependencyUnavailableError(f"Ollama request failed: {exc}") from exc
        return (response.message.content or "").strip()

    def generate_stream(self, *, system: str, prompt: str, temperature: float = 0.1):
        if not self.available():
            raise DependencyUnavailableError(
                "Ollama is not reachable. Start it with `ollama serve` and pull a model "
                f"(default: `ollama pull {self.model_name}`)."
            )
        try:
            stream = self._client.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                options={"temperature": temperature},
                stream=True,
            )
            for part in stream:
                content = _chunk_text(part)
                if content:
                    yield content
        except DependencyUnavailableError:
            raise
        except Exception as exc:
            logger.exception("Ollama generation failed")
            raise DependencyUnavailableError(f"Ollama request failed: {exc}") from exc

    def generate_json(self, *, system: str, prompt: str) -> str:
        if not self.available():
            raise DependencyUnavailableError("Ollama is not reachable.")
        response = self._client.chat(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            format="json",
            options={"temperature": 0.0},
        )
        return (response.message.content or "").strip()

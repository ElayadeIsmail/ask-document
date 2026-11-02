from __future__ import annotations

import json
import logging
from collections.abc import Callable

from fastapi.responses import StreamingResponse

from app.core.exceptions import AskDocError
from app.schemas.qa import AskRequest, AskResponse
from app.services.rag import RAGService

logger = logging.getLogger("askdoc")


def stream_answer(
    rag: RAGService,
    request: AskRequest,
    save: Callable[[AskResponse], None],
) -> StreamingResponse:
    prepared = rag.prepare(request)

    def events():
        yield _sse({"type": "sources", "sources": [hit.model_dump() for hit in prepared.hits]})
        parts: list[str] = []
        try:
            for token in rag.iter_answer(prepared):
                parts.append(token)
                yield _sse({"type": "token", "text": token})
        except AskDocError as exc:
            yield _sse({"type": "error", "detail": exc.message})
            return
        done = rag.complete(prepared, "".join(parts).strip())
        try:
            save(done)
        except Exception:
            logger.exception("Failed to store chat")
            yield _sse({"type": "error", "detail": "The answer could not be saved"})
            return
        yield _sse(
            {
                "type": "done",
                "answer": done.answer,
                "citations": [item.model_dump() for item in done.citations],
                "sources": [hit.model_dump() for hit in done.sources],
                "model": done.model,
            }
        )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

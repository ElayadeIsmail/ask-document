import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import get_rag
from app.core.exceptions import AskDocError
from app.schemas.qa import AskRequest, AskResponse
from app.services.rag import RAGService

router = APIRouter(tags=["qa"])


@router.post("/ask", response_model=AskResponse)
def ask_question(payload: AskRequest, rag: RAGService = Depends(get_rag)) -> AskResponse:
    return rag.ask(payload)


@router.post("/ask/stream")
def ask_question_stream(
    payload: AskRequest, rag: RAGService = Depends(get_rag)
) -> StreamingResponse:
    prepared = rag.prepare(payload)

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
        answer = "".join(parts).strip()
        done = rag.complete(prepared, answer)
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

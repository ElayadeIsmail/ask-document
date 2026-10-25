from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass

from app.core.config import Settings
from app.core.exceptions import AskDocError
from app.schemas.qa import AskRequest, AskResponse, Citation, PriorTurn
from app.schemas.search import SearchHit, SearchRequest, SearchResponse
from app.services.embeddings import EmbeddingService
from app.services.llm import LLMService
from app.services.reranker import RerankerService
from app.services.vectorstore import VectorStore

_CITE_RE = re.compile(r"\[(\d+)\]")

_SYSTEM_PROMPT = """You are AskDoc, a retrieval-augmented assistant.
Answer the user using ONLY the numbered sources.
Cite sources as [1], [2], immediately after the claims they support.
If the sources do not contain the answer, say you cannot find it in the uploaded documents.
Do not invent page numbers or filenames. Keep answers concise and factual.
Earlier conversation only tells you what the user is referring to. It is not a source.
"""


@dataclass
class PreparedAsk:
    question: str
    hits: list[SearchHit]
    prompt: str
    temperature: float


class RAGService:
    def __init__(
        self,
        settings: Settings,
        embeddings: EmbeddingService,
        vectorstore: VectorStore,
        reranker: RerankerService,
        llm: LLMService,
    ) -> None:
        self._settings = settings
        self._embeddings = embeddings
        self._vectorstore = vectorstore
        self._reranker = reranker
        self._llm = llm

    def search(self, request: SearchRequest, rerank: bool = True) -> SearchResponse:
        retrieve_k = request.top_k or self._settings.retrieve_k
        if rerank:
            retrieve_k = max(retrieve_k, self._settings.retrieve_k)
        query_embedding = self._embeddings.embed_query(request.query)
        hits = self._vectorstore.query(
            query_embedding,
            n_results=retrieve_k,
            collection_id=request.collection_id,
            document_ids=request.document_ids,
        )
        if rerank and hits:
            top_k = request.top_k or self._settings.rerank_k
            hits = self._reranker.rerank(request.query, hits, top_k=top_k)
        elif request.top_k:
            hits = hits[: request.top_k]
        return SearchResponse(query=request.query, hits=hits)

    def prepare(self, request: AskRequest) -> PreparedAsk:
        top_k = request.top_k or self._settings.rerank_k
        search = self.search(
            SearchRequest(
                query=_retrieval_query(request.question, request.history),
                collection_id=request.collection_id,
                document_ids=request.document_ids or None,
                top_k=top_k,
            ),
            rerank=True,
        )
        if not search.hits:
            raise AskDocError(
                "No indexed documents match this query. Upload PDFs and wait until they are ready.",
                status_code=404,
            )
        return PreparedAsk(
            question=request.question,
            hits=search.hits,
            prompt=_build_prompt(request.question, search.hits, request.history),
            temperature=request.temperature,
        )

    def ask(self, request: AskRequest) -> AskResponse:
        prepared = self.prepare(request)
        answer = self._llm.generate(
            system=_SYSTEM_PROMPT,
            prompt=prepared.prompt,
            temperature=prepared.temperature,
        )
        return self.complete(prepared, answer)

    def iter_answer(self, prepared: PreparedAsk) -> Iterator[str]:
        yield from self._llm.generate_stream(
            system=_SYSTEM_PROMPT,
            prompt=prepared.prompt,
            temperature=prepared.temperature,
        )

    def complete(self, prepared: PreparedAsk, answer: str) -> AskResponse:
        return AskResponse(
            question=prepared.question,
            answer=answer,
            citations=_citations_from_answer(answer, prepared.hits),
            sources=prepared.hits,
            model=self._llm.model_name,
        )


def _retrieval_query(question: str, history: list[PriorTurn]) -> str:
    if not history:
        return question
    previous = history[-1].question.strip()
    if not previous:
        return question
    return f"{previous}\n{question}"[:4000]


def _build_prompt(
    question: str, hits: list[SearchHit], history: list[PriorTurn] | None = None
) -> str:
    blocks = []
    for index, hit in enumerate(hits, start=1):
        snippet = hit.text.strip().replace("\n", " ")
        blocks.append(f"[{index}] {hit.filename} (page {hit.page})\n{snippet}")
    sources = "\n\n".join(blocks)
    history_block = ""
    if history:
        turns = []
        for turn in history[-4:]:
            answer = turn.answer.strip().replace("\n", " ")
            if len(answer) > 800:
                answer = answer[:800] + "…"
            turns.append(f"User: {turn.question.strip()}\nAssistant: {answer}")
        history_block = "Earlier conversation:\n" + "\n\n".join(turns) + "\n\n"
    return (
        f"{history_block}Sources:\n{sources}\n\nQuestion: {question}\n\n"
        "Answer with inline citations like [1]."
    )


def _citations_from_answer(answer: str, hits: list[SearchHit]) -> list[Citation]:
    cited = []
    seen: set[int] = set()
    for match in _CITE_RE.finditer(answer):
        n = int(match.group(1))
        if n in seen or n < 1 or n > len(hits):
            continue
        seen.add(n)
        hit = hits[n - 1]
        cited.append(
            Citation(
                n=n,
                document_id=hit.document_id,
                filename=hit.filename,
                page=hit.page,
                snippet=hit.text[:400],
                score=hit.score,
            )
        )
    if cited:
        return cited
    return [
        Citation(
            n=index,
            document_id=hit.document_id,
            filename=hit.filename,
            page=hit.page,
            snippet=hit.text[:400],
            score=hit.score,
        )
        for index, hit in enumerate(hits[:3], start=1)
    ]

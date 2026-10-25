from __future__ import annotations

import logging
import os
from typing import Any

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
os.environ.setdefault("CHROMA_TELEMETRY_DISABLED", "1")

import chromadb  # noqa: E402
from chromadb.api.models.Collection import Collection as ChromaCollection  # noqa: E402

from app.core.config import Settings
from app.schemas.search import SearchHit
from app.services.chunking import Chunk

logger = logging.getLogger(__name__)

COLLECTION_NAME = "askdoc_chunks"


class VectorStore:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(settings.chroma_dir))
        self._collection: ChromaCollection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=None,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_chunks(
        self,
        *,
        document_id: str,
        collection_id: str,
        filename: str,
        chunks: list[Chunk],
        embeddings: list[list[float]],
    ) -> None:
        if not chunks:
            return
        ids = [f"{document_id}:{chunk.index}" for chunk in chunks]
        metadatas = [
            {
                "document_id": document_id,
                "collection_id": collection_id,
                "filename": filename,
                "page": chunk.page,
                "chunk_index": chunk.index,
            }
            for chunk in chunks
        ]
        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=[chunk.text for chunk in chunks],
            metadatas=metadatas,
        )
        logger.info("Indexed %s chunks for document %s", len(chunks), document_id)

    def delete_document(self, document_id: str) -> None:
        self._collection.delete(where={"document_id": document_id})

    def delete_collection(self, collection_id: str) -> None:
        self._collection.delete(where={"collection_id": collection_id})

    def query(
        self,
        embedding: list[float],
        *,
        n_results: int,
        collection_id: str | None = None,
        document_ids: list[str] | None = None,
    ) -> list[SearchHit]:
        total = self._collection.count()
        if total == 0:
            return []
        where = _build_where(collection_id=collection_id, document_ids=document_ids)
        kwargs: dict[str, Any] = {
            "query_embeddings": [embedding],
            "n_results": min(n_results, total),
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where
        result = self._collection.query(**kwargs)
        hits: list[SearchHit] = []
        ids = (result.get("ids") or [[]])[0]
        docs = (result.get("documents") or [[]])[0]
        metas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        for chunk_id, text, meta, distance in zip(ids, docs, metas, distances, strict=False):
            score = 1.0 - float(distance) if distance is not None else 0.0
            hits.append(
                SearchHit(
                    chunk_id=chunk_id,
                    document_id=str(meta.get("document_id", "")),
                    collection_id=str(meta.get("collection_id", "")),
                    filename=str(meta.get("filename", "")),
                    page=int(meta.get("page") or 0),
                    text=text or "",
                    score=score,
                )
            )
        return hits


def _build_where(
    collection_id: str | None, document_ids: list[str] | None
) -> dict[str, Any] | None:
    clauses: list[dict[str, Any]] = []
    if collection_id:
        clauses.append({"collection_id": collection_id})
    if document_ids:
        clauses.append({"document_id": {"$in": document_ids}})
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}

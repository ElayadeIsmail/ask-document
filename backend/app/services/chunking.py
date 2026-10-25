from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.pdf_parser import ParsedDocument

_SPLIT_RE = re.compile(r"(?<=[\n.!?])\s+")
_HEADING_RE = re.compile(r"^[A-Z0-9][A-Za-z0-9 ,/&:'-]{7,80}$")


@dataclass
class Chunk:
    text: str
    page: int
    index: int


def extract_headings(parsed: ParsedDocument, limit: int = 25) -> list[str]:
    seen: list[str] = []
    for page in parsed.pages:
        for raw in page.text.splitlines():
            line = raw.strip()
            if not line or line.endswith("."):
                continue
            if _HEADING_RE.match(line) and (line.isupper() or line.istitle()):
                if line not in seen:
                    seen.append(line)
            if len(seen) >= limit:
                return seen
    return seen


def chunk_document(parsed: ParsedDocument, chunk_size: int, overlap: int) -> list[Chunk]:
    chunks: list[Chunk] = []
    index = 0
    for page in parsed.pages:
        page_chunks = _split_text(page.text, chunk_size, overlap)
        for text in page_chunks:
            chunks.append(Chunk(text=text, page=page.page_number, index=index))
            index += 1
    return chunks


def _split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    cleaned = re.sub(r"[ \t]+", " ", text).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if not cleaned:
        return []
    if len(cleaned) <= chunk_size:
        return [cleaned]

    pieces = [p.strip() for p in _SPLIT_RE.split(cleaned) if p.strip()]
    chunks: list[str] = []
    current = ""
    for piece in pieces:
        candidate = f"{current} {piece}".strip() if current else piece
        if len(candidate) <= chunk_size:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(piece) > chunk_size:
            chunks.extend(_hard_wrap(piece, chunk_size, overlap))
            current = ""
        else:
            current = piece
    if current:
        chunks.append(current)

    if overlap <= 0 or len(chunks) < 2:
        return chunks
    return _apply_overlap(chunks, overlap)


def _hard_wrap(text: str, chunk_size: int, overlap: int) -> list[str]:
    step = max(chunk_size - overlap, 1)
    return [
        text[i : i + chunk_size].strip()
        for i in range(0, len(text), step)
        if text[i : i + chunk_size].strip()
    ]


def _apply_overlap(chunks: list[str], overlap: int) -> list[str]:
    overlapped = [chunks[0]]
    for chunk in chunks[1:]:
        previous = overlapped[-1]
        tail = previous[-overlap:] if len(previous) > overlap else previous
        merged = f"{tail} {chunk}".strip()
        overlapped.append(merged)
    return overlapped

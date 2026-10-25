from __future__ import annotations

import json
import logging
import re

from app.schemas.document import StructuredInfo
from app.services.chunking import extract_headings
from app.services.llm import LLMService
from app.services.pdf_parser import ParsedDocument

logger = logging.getLogger(__name__)

_LANG_HINTS = (
    ("fr", re.compile(r"\b(le|la|les|des|une|est|pour)\b", re.I)),
    ("ar", re.compile(r"[\u0600-\u06FF]")),
    ("en", re.compile(r"\b(the|and|of|to|in|for)\b", re.I)),
)


def extract_structured_info(
    parsed: ParsedDocument,
    llm: LLMService | None = None,
) -> StructuredInfo:
    metadata = parsed.metadata
    title = metadata.get("title") or _guess_title(parsed)
    authors = _split_authors(metadata.get("author"))
    info = StructuredInfo(
        title=title,
        authors=authors,
        creation_date=metadata.get("creationDate") or metadata.get("modDate"),
        language=_guess_language(parsed.full_text[:4000]),
        headings=extract_headings(parsed),
        page_count=parsed.page_count,
        ocr_used=parsed.ocr_page_count > 0,
    )
    if llm and llm.available():
        try:
            enriched = _llm_enrich(parsed, info, llm)
            info = info.model_copy(update=enriched)
        except Exception:
            logger.exception("LLM structured extraction failed; using heuristic metadata")
    return info


def _guess_title(parsed: ParsedDocument) -> str | None:
    if not parsed.pages:
        return parsed.path.stem
    for line in parsed.pages[0].text.splitlines():
        candidate = line.strip()
        if 8 <= len(candidate) <= 140:
            return candidate
    return parsed.path.stem


def _split_authors(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = re.split(r";|,| and ", raw)
    return [part.strip() for part in parts if part.strip()]


def _guess_language(text: str) -> str | None:
    if not text.strip():
        return None
    scores = {code: len(pattern.findall(text)) for code, pattern in _LANG_HINTS}
    best = max(scores, key=scores.get)
    return best if scores[best] else None


def _llm_enrich(parsed: ParsedDocument, info: StructuredInfo, llm: LLMService) -> dict:
    sample = parsed.full_text[:6000]
    prompt = f"""Extract structured metadata from this document.
Return JSON with keys: title, authors (array of strings), document_type
(one of: report, paper, contract, invoice, manual, other), language (en/fr/ar/other),
summary (3 sentences max), key_topics (array of up to 8 short topics).

Known PDF metadata:
title={info.title}
authors={info.authors}

Document text:
{sample}
"""
    raw = llm.generate_json(
        system="You extract document metadata. Reply with JSON only.",
        prompt=prompt,
    )
    data = json.loads(raw)
    update: dict = {}
    if data.get("title"):
        update["title"] = str(data["title"])[:255]
    if isinstance(data.get("authors"), list):
        update["authors"] = [str(a) for a in data["authors"] if str(a).strip()]
    if data.get("document_type"):
        update["document_type"] = str(data["document_type"])
    if data.get("language"):
        update["language"] = str(data["language"])
    if data.get("summary"):
        update["summary"] = str(data["summary"])
    if isinstance(data.get("key_topics"), list):
        update["key_topics"] = [str(t) for t in data["key_topics"] if str(t).strip()][:8]
    return update

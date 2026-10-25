from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

from app.core.config import Settings
from app.services.ocr import ocr_pixmap, tesseract_available

logger = logging.getLogger(__name__)


@dataclass
class PageContent:
    page_number: int
    text: str
    ocr_used: bool = False


@dataclass
class ParsedDocument:
    path: Path
    page_count: int
    metadata: dict[str, str]
    pages: list[PageContent] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        parts = []
        for page in self.pages:
            parts.append(f"\n\n--- Page {page.page_number} ---\n{page.text}")
        return "".join(parts).strip()

    @property
    def ocr_page_count(self) -> int:
        return sum(1 for page in self.pages if page.ocr_used)


def parse_pdf(path: Path, settings: Settings) -> ParsedDocument:
    doc = pymupdf.open(path)
    try:
        raw_meta = doc.metadata or {}
        metadata = {
            str(key): str(value).strip()
            for key, value in raw_meta.items()
            if value and str(value).strip()
        }
        pages: list[PageContent] = []
        can_ocr = settings.ocr_enabled and tesseract_available()

        for index, page in enumerate(doc):
            text = (page.get_text("text") or "").strip()
            ocr_used = False
            if can_ocr and len(text) < settings.ocr_min_chars:
                pixmap = page.get_pixmap(dpi=200, alpha=False)
                ocr_text = ocr_pixmap(pixmap.tobytes("png"), settings).strip()
                if len(ocr_text) > len(text):
                    text = ocr_text
                    ocr_used = True
                    logger.info("OCR applied on %s page %s", path.name, index + 1)
            pages.append(PageContent(page_number=index + 1, text=text, ocr_used=ocr_used))

        return ParsedDocument(
            path=path,
            page_count=doc.page_count,
            metadata=metadata,
            pages=pages,
        )
    finally:
        doc.close()

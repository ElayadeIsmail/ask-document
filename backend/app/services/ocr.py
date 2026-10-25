from __future__ import annotations

import io
import logging

from PIL import Image

from app.core.config import Settings

logger = logging.getLogger(__name__)

_tesseract_available: bool | None = None


def tesseract_available() -> bool:
    global _tesseract_available
    if _tesseract_available is not None:
        return _tesseract_available
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        _tesseract_available = True
    except Exception:
        _tesseract_available = False
        logger.warning("Tesseract OCR is not available; scanned PDFs will have limited text.")
    return _tesseract_available


def ocr_pixmap(image_bytes: bytes, settings: Settings) -> str:
    if not settings.ocr_enabled or not tesseract_available():
        return ""
    import pytesseract

    image = Image.open(io.BytesIO(image_bytes))
    if image.mode not in {"L", "RGB"}:
        image = image.convert("RGB")
    try:
        return pytesseract.image_to_string(image, lang=settings.ocr_lang) or ""
    except Exception:
        logger.exception("OCR failed")
        return ""

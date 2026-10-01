"""OCR helpers for scanned / image based PDFs.

Tesseract is optional: when pytesseract, pdf2image (or Poppler) are missing the
service reports this honestly in the response ``warnings`` instead of failing
silently.
"""

from __future__ import annotations

import logging
import shutil
from typing import Optional

from utils.config import settings

logger = logging.getLogger("loanlens.ocr")

_dependencies_checked = False
_pytesseract = None
_convert_from_bytes = None
_load_error: Optional[str] = None


def _load_dependencies() -> tuple[object, object]:
    """Import the OCR stack lazily so the service boots without it."""
    global _dependencies_checked, _pytesseract, _convert_from_bytes, _load_error

    if _dependencies_checked:
        return _pytesseract, _convert_from_bytes

    _dependencies_checked = True
    try:
        import pytesseract  # type: ignore
        from pdf2image import convert_from_bytes  # type: ignore

        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

        _pytesseract = pytesseract
        _convert_from_bytes = convert_from_bytes
    except Exception as exc:  # pragma: no cover - environment dependent
        _load_error = str(exc)
        logger.info("OCR stack unavailable: %s", exc)

    return _pytesseract, _convert_from_bytes


def tesseract_binary_available() -> bool:
    if settings.tesseract_cmd:
        return shutil.which(settings.tesseract_cmd) is not None
    return shutil.which("tesseract") is not None


def ocr_status() -> dict:
    pytesseract, convert_from_bytes = _load_dependencies()
    return {
        "available": bool(pytesseract and convert_from_bytes and tesseract_binary_available()),
        "pytesseract": pytesseract is not None,
        "pdf2image": convert_from_bytes is not None,
        "tesseract_binary": tesseract_binary_available(),
        "language": settings.ocr_lang,
        "error": _load_error,
    }


def ocr_pdf_bytes(data: bytes) -> tuple[str, list[str]]:
    """OCR the first N pages of a PDF.

    Returns ``(text, warnings)``. Never raises - failures are reported as
    warnings so the caller can decide what to tell the user.
    """
    warnings: list[str] = []

    pytesseract, convert_from_bytes = _load_dependencies()
    if not pytesseract or not convert_from_bytes:
        warnings.append(
            "OCR is unavailable because pytesseract/pdf2image are not installed. "
            "Install requirements-ml.txt and the Tesseract binary to read scanned PDFs."
        )
        return "", warnings

    if not tesseract_binary_available():
        warnings.append(
            "The Tesseract binary was not found on PATH. Set TESSERACT_CMD or install Tesseract."
        )
        return "", warnings

    try:
        pages = convert_from_bytes(
            data, dpi=300, first_page=1, last_page=settings.ocr_max_pages, fmt="png"
        )
    except Exception as exc:  # pragma: no cover - depends on Poppler
        warnings.append(f"Could not render PDF pages for OCR: {exc}")
        return "", warnings

    chunks: list[str] = []
    for index, image in enumerate(pages):
        try:
            chunks.append(pytesseract.image_to_string(image, lang=settings.ocr_lang) or "")
        except Exception as exc:  # pragma: no cover - depends on Tesseract
            warnings.append(f"OCR failed on page {index + 1}: {exc}")

    text = "\n".join(chunk.strip() for chunk in chunks if chunk.strip())
    if not text:
        warnings.append("OCR ran but did not detect readable text in this document.")

    return text, warnings

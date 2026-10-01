"""PDF text extraction pipeline.

Order of preference:

1. PyMuPDF (``fitz``)    - fastest, best layout fidelity
2. pdfplumber            - very good for tables / awkward layouts
3. pypdf                 - pure Python fallback (always available)

If the extracted text is too short to be a real agreement the document is
treated as scanned and the OCR path is used.
"""

from __future__ import annotations

import io
import logging

from pipeline.ocr import ocr_pdf_bytes
from utils.config import settings
from utils.text_clean import clean_text, count_document_chars

logger = logging.getLogger("loanlens.extraction")


def _pymupdf_module():
    """Import PyMuPDF under its current or legacy module name."""
    try:
        import pymupdf  # type: ignore

        return pymupdf
    except ImportError:
        import fitz  # type: ignore

        return fitz


def _extract_with_pymupdf(data: bytes) -> tuple[str, int]:
    module = _pymupdf_module()
    with module.open(stream=data, filetype="pdf") as document:
        pages = document.page_count
        chunks = [page.get_text("text") or "" for page in document]
    return "\n".join(chunks), pages


def _extract_with_pdfplumber(data: bytes) -> tuple[str, int]:
    import pdfplumber  # type: ignore

    chunks: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        pages = len(pdf.pages)
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n".join(chunks), pages


def _extract_with_pypdf(data: bytes) -> tuple[str, int]:
    from pypdf import PdfReader  # type: ignore

    reader = PdfReader(io.BytesIO(data))
    if getattr(reader, "is_encrypted", False):
        try:
            reader.decrypt("")  # empty password (owner-password only PDFs)
        except Exception:  # pragma: no cover - depends on the file
            raise ValueError("This PDF is password protected.")
    chunks = [(page.extract_text() or "") for page in reader.pages]
    return "\n".join(chunks), len(reader.pages)


EXTRACTORS = [
    ("pymupdf", _extract_with_pymupdf),
    ("pdfplumber", _extract_with_pdfplumber),
    ("pypdf", _extract_with_pypdf),
]


def extract_from_bytes(data: bytes, filename: str = "", allow_ocr: bool = True) -> dict:
    """Extract text from PDF bytes.

    Returns a dict with ``text``, ``pages``, ``method``, ``ocr_used``,
    ``characters`` and ``warnings``.
    """
    warnings: list[str] = []
    best_text = ""
    best_pages = 0
    best_method = "unavailable"

    for name, extractor in EXTRACTORS:
        try:
            text, pages = extractor(data)
        except ImportError as exc:
            logger.debug("%s extractor unavailable: %s", name, exc)
            continue
        except Exception as exc:
            warnings.append(f"{name} could not read this PDF: {exc}")
            logger.info("%s extraction failed: %s", name, exc)
            continue

        if count_document_chars(text) > count_document_chars(best_text):
            best_text, best_pages, best_method = text, pages, name

        if count_document_chars(best_text) >= settings.min_text_chars:
            break

    cleaned = clean_text(best_text)
    characters = count_document_chars(cleaned)
    ocr_used = False

    if characters < settings.min_text_chars and allow_ocr:
        warnings.append(
            "Little or no selectable text was found, so the document was treated as scanned and an OCR pass was attempted."
        )
        ocr_text, ocr_warnings = ocr_pdf_bytes(data)
        warnings.extend(ocr_warnings)

        if count_document_chars(ocr_text) > characters:
            cleaned = clean_text(ocr_text)
            characters = count_document_chars(cleaned)
            best_method = "tesseract-ocr"
            ocr_used = True

    if characters == 0:
        warnings.append(
            "No text could be extracted from this document. It may be a scanned image, protected or corrupted."
        )

    return {
        "text": cleaned,
        "pages": best_pages,
        "method": best_method,
        "ocr_used": ocr_used,
        "characters": characters,
        "warnings": warnings,
        "filename": filename,
    }

"""Health and capability endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from models.classifier import classifier
from models.summarizer import summarizer
from pipeline.extraction import EXTRACTORS  # noqa: F401  (documented extractor chain)
from pipeline.ocr import ocr_status
from rules.risk_rules import RISK_RULES
from utils.config import settings

router = APIRouter(tags=["health"])


def _extractor_status() -> dict:
    status = {}
    for name in ("pymupdf", "pdfplumber", "pypdf"):
        try:
            if name == "pymupdf":
                try:
                    import pymupdf  # noqa: F401
                except ImportError:
                    import fitz  # noqa: F401
            elif name == "pdfplumber":
                import pdfplumber  # noqa: F401
            else:
                import pypdf  # noqa: F401

            status[name] = True
        except Exception:
            status[name] = False
    return status


@router.get("/health")
def health() -> dict:
    """Liveness + capability probe used by the Node backend."""
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "engines": {
            "rulebook": {"rules": len(RISK_RULES)},
            "classifier": classifier.status(),
            "summarizer": summarizer.status(),
            "extraction": _extractor_status(),
            "ocr": ocr_status(),
        },
        "notice": (
            "When ENABLE_TRANSFORMERS is false or model weights are missing, the service "
            "uses clearly-labelled heuristic/rule-based fallbacks rather than a trained model."
        ),
    }

"""Analysis endpoints.

Granular endpoints (``/extract``, ``/segment``, ``/classify``, ``/summarize``)
are used by the Node backend so it can report real per-stage progress. The
``/analyze`` endpoint runs everything in one call for standalone use.
"""

from __future__ import annotations

import base64
import binascii
import logging
import os
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from models.classifier import classifier
from models.summarizer import summarizer
from pipeline.classification import classify_clauses, evaluate_document
from pipeline.extraction import extract_from_bytes
from pipeline.segmentation import detect_structure, segment_clauses
from pipeline.summarization import summarize_clauses
from rules.risk_rules import RISK_RULES, rules_metadata
from utils.config import settings

logger = logging.getLogger("loanlens.api")

router = APIRouter(tags=["analysis"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ClauseIn(BaseModel):
    clause_number: str = ""
    title: str = ""
    text: str = ""


class ExtractRequest(BaseModel):
    file_b64: Optional[str] = None
    file_path: Optional[str] = None
    filename: str = ""
    allow_ocr: bool = True


class SegmentRequest(BaseModel):
    text: str = ""


class ClassifyRequest(BaseModel):
    clauses: List[ClauseIn] = Field(default_factory=list)


class SummarizeRequest(BaseModel):
    clauses: List[ClauseIn] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    clauses: Optional[List[ClauseIn]] = None
    file_b64: Optional[str] = None
    file_path: Optional[str] = None
    filename: str = ""
    allow_ocr: bool = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clause_payload(clauses: List[ClauseIn]) -> list[dict]:
    return [
        {
            "index": index,
            "clause_number": clause.clause_number or str(index + 1),
            "title": clause.title or f"Clause {index + 1}",
            "text": clause.text or "",
        }
        for index, clause in enumerate(clauses)
    ]


def _read_document(request: ExtractRequest) -> tuple[bytes | None, list[str]]:
    """Resolve the PDF bytes from either inline base64 or a server side path."""
    warnings: list[str] = []

    if request.file_b64:
        try:
            return base64.b64decode(request.file_b64, validate=False), warnings
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc

    if request.file_path:
        if not os.path.isfile(request.file_path):
            raise HTTPException(status_code=404, detail="file_path does not exist on this server")
        with open(request.file_path, "rb") as handle:
            return handle.read(), warnings

    warnings.append("No document was supplied, so no text could be extracted.")
    return None, warnings


def _engine_status() -> dict:
    return {
        "rule_engine": {"engine": "rule-engine", "rules": len(RISK_RULES), "version": "1.0.0"},
        "classifier": classifier.status(),
        "summarizer": summarizer.status(),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/extract")
def extract(request: ExtractRequest) -> dict:
    """Extract text from a PDF (digital extraction, then OCR fallback)."""
    data, warnings = _read_document(request)
    if data is None:
        return {
            "text": "",
            "pages": 0,
            "method": "not-provided",
            "ocr_used": False,
            "characters": 0,
            "warnings": warnings,
        }

    result = extract_from_bytes(data, filename=request.filename, allow_ocr=request.allow_ocr)
    result["warnings"] = warnings + result.get("warnings", [])
    return result


@router.post("/extract/upload")
async def extract_upload(file: UploadFile = File(...), allow_ocr: bool = True) -> dict:
    """Convenience multipart endpoint for manual testing."""
    data = await file.read()
    return extract_from_bytes(data, filename=file.filename or "", allow_ocr=allow_ocr)


@router.post("/segment")
def segment(request: SegmentRequest) -> dict:
    """Clean the text and split it into clauses."""
    clauses = segment_clauses(request.text)
    cleaned = " ".join(clause["text"] for clause in clauses)
    return {
        "clauses": clauses,
        "structure": detect_structure(request.text),
        "cleaned_text": cleaned[:2000],
        "count": len(clauses),
    }


@router.post("/classify")
def classify(request: ClassifyRequest) -> dict:
    """Run the rule engine and the classifier, then combine the two."""
    clauses = _clause_payload(request.clauses)
    results = classify_clauses(clauses)

    return {
        "results": [
            {
                "index": item["index"],
                "rule": item["rule"],
                "ml": item["ml"],
                "combined": item["combined"],
            }
            for item in results
        ],
        "engine": _engine_status(),
    }


@router.post("/summarize")
def summarize(request: SummarizeRequest) -> dict:
    """Produce a plain-English summary for each clause."""
    clauses = _clause_payload(request.clauses)
    return {"summaries": summarize_clauses(clauses), "engine": summarizer.status()}


@router.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict:
    """Full pipeline in a single call: extract -> segment -> risk -> summary."""
    warnings: list[str] = []

    # 1. Obtain clauses (from provided clauses, from text, or from a PDF).
    if request.clauses:
        clauses = _clause_payload(request.clauses)
    else:
        text = request.text or ""
        if not text and (request.file_b64 or request.file_path):
            data, read_warnings = _read_document(
                ExtractRequest(
                    file_b64=request.file_b64,
                    file_path=request.file_path,
                    filename=request.filename,
                    allow_ocr=request.allow_ocr,
                )
            )
            warnings.extend(read_warnings)
            if data:
                extraction = extract_from_bytes(
                    data, filename=request.filename, allow_ocr=request.allow_ocr
                )
                warnings.extend(extraction.get("warnings", []))
                text = extraction.get("text", "")

        clauses = segment_clauses(text)

    if not clauses:
        raise HTTPException(
            status_code=422,
            detail="No clauses could be identified. Provide text, clauses, or a readable PDF.",
        )

    # 2. Clause level risk analysis + summarisation.
    classified = classify_clauses(clauses)
    summaries = summarize_clauses(clauses)

    final_clauses = []
    for index, clause in enumerate(clauses):
        combined = classified[index]["combined"]
        summary = summaries[index]["summary"] if index < len(summaries) else ""

        final_clauses.append(
            {
                "clause_number": clause["clause_number"],
                "index": index,
                "title": clause["title"],
                "text": clause["text"],
                "original_text": clause["text"],
                "summary": summary,
                "classification": combined["classification"],
                "risk_category": combined["risk_category"],
                "confidence": combined["confidence"],
                "reason": combined["reason"],
                "regulatory_reference": combined["regulatory_reference"],
                "regulatory_verified": combined["regulatory_verified"],
                "rule_id": combined["rule_id"],
                "rule_severity": combined["rule_severity"],
                "rule_matched": combined["rule_matched"],
                "rule_result": combined["rule_result"],
                "ml_result": combined["ml_result"],
                "ml_confidence": combined["ml_confidence"],
                "model": classified[index]["ml"].get("model", "unknown"),
            }
        )

    evaluation = evaluate_document([{"classification": item["classification"]} for item in final_clauses])

    return {
        "clauses": final_clauses,
        "risk_summary": evaluation["risk_summary"],
        "overall_score": evaluation["overall_score"],
        "overall_risk": evaluation["overall_risk"],
        "engine": _engine_status(),
        "warnings": warnings,
    }


@router.get("/rules")
def list_rules() -> dict:
    """Expose the rulebook (and its regulatory references) for the UI."""
    return {
        "rules": rules_metadata(),
        "count": len(RISK_RULES),
        "notice": (
            "Regulatory references are stored for transparency and are marked "
            "regulatory_verified=false until a human confirms the exact citation."
        ),
    }


@router.get("/engine")
def engine_status() -> dict:
    """Report which engines are active (rules, classifier, summariser)."""
    return {
        "engines": _engine_status(),
        "settings": {
            "enable_transformers": settings.enable_transformers,
            "classifier_model": settings.classifier_model,
            "summarizer_model": settings.summarizer_model,
            "min_text_chars": settings.min_text_chars,
            "ocr_max_pages": settings.ocr_max_pages,
        },
    }

"""Runtime configuration for the LoanLens ML service."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _as_bool(value: str | None, fallback: bool = False) -> bool:
    if value is None or value == "":
        return fallback
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, fallback: int) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return fallback


def _as_float(value: str | None, fallback: float) -> float:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return fallback


@dataclass
class Settings:
    """Environment driven settings (see the repository root .env.example)."""

    service_name: str = "loanlens-ml-service"
    version: str = "1.0.0"

    # Text shorter than this (in non whitespace characters) triggers the OCR
    # fallback for scanned documents.
    min_text_chars: int = _as_int(os.getenv("ML_MIN_TEXT_CHARS"), 400)

    # Only the first N pages are OCR'd, to keep requests responsive.
    ocr_max_pages: int = _as_int(os.getenv("ML_OCR_MAX_PAGES"), 12)
    ocr_lang: str = os.getenv("OCR_LANG", "eng")
    tesseract_cmd: str | None = os.getenv("TESSERACT_CMD") or None

    # Set ENABLE_TRANSFORMERS=true once the model weights are available.
    enable_transformers: bool = _as_bool(os.getenv("ENABLE_TRANSFORMERS"), False)
    classifier_model: str = os.getenv("ML_CLASSIFIER_MODEL", "distilbert-base-uncased")
    classifier_weights: str = os.getenv("ML_CLASSIFIER_WEIGHTS", "")
    # Trained artifacts produced by `python -m training.train_classifier` and
    # `python -m training.train_transformer`. Leave empty to use the defaults
    # under ml-service/models/artifacts.
    classifier_artifact: str = os.getenv("ML_CLASSIFIER_ARTIFACT", "")
    transformer_artifact: str = os.getenv("ML_TRANSFORMER_ARTIFACT", "")
    summarizer_model: str = os.getenv("ML_SUMMARIZER_MODEL", "t5-small")
    summarizer_weights: str = os.getenv("ML_SUMMARIZER_WEIGHTS", "")

    # Never join more than this many characters into a single model call.
    max_model_chars: int = _as_int(os.getenv("ML_MAX_MODEL_CHARS"), 1200)
    max_clauses: int = _as_int(os.getenv("ML_MAX_CLAUSES"), 200)

    # Risk scoring - kept in step with server/services/riskService.js
    clause_weights: dict = field(
        default_factory=lambda: {"Normal": 0, "Needs Review": 3, "Risky": 10}
    )
    risk_amplifier: float = _as_float(os.getenv("ML_RISK_AMPLIFIER"), 1.3)


settings = Settings()

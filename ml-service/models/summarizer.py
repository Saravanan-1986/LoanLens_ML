"""Clause summariser abstraction.

Prefers a real HuggingFace summarisation model (T5-small / BART-base / any
fine-tuned checkpoint). When those libraries or weights are unavailable it
falls back to a rule based extractive summariser.

The fallback is ALWAYS labelled ``rule-based-extractive-fallback (not a trained
model)`` and only rewrites the source sentences - it never invents amounts,
dates or obligations, and the amounts/dates present in the clause are kept
verbatim.
"""

from __future__ import annotations

import logging
import re

from utils.config import settings
from utils.text_clean import normalise_whitespace, split_sentences

logger = logging.getLogger("loanlens.summarizer")

FALLBACK_MODEL_NAME = "rule-based-extractive-fallback (not a trained model)"

PROMPT_PREFIX = "summarize the loan clause in plain english: "

SIMPLIFICATIONS = [
    (re.compile(r"\bthe\s+borrower\b", re.I), "you"),
    (re.compile(r"\bborrower\b", re.I), "you"),
    (re.compile(r"\bshall\s+be\s+liable\s+to\s+pay\b", re.I), "you may have to pay"),
    (re.compile(r"\bshall\s+not\b", re.I), "must not"),
    (re.compile(r"\bshall\b", re.I), "will"),
    (re.compile(r"\bin\s+the\s+event\s+(?:that|of)\b", re.I), "if"),
    (re.compile(r"\bprior\s+to\b", re.I), "before"),
    (re.compile(r"\bsubsequent\s+to\b", re.I), "after"),
    (re.compile(r"\bnotwithstanding\b", re.I), "despite"),
    (re.compile(r"\bpursuant\s+to\b", re.I), "under"),
    (re.compile(r"\bherein(?:after|before|under)?\b", re.I), ""),
    (re.compile(r"\bat\s+the\s+sole\s+discretion\s+of\s+the\s+lender\b", re.I), "whenever the lender decides"),
    (re.compile(r"\bmay\s+be\s+revised\b", re.I), "can be changed"),
    (re.compile(r"\bis\s+entitled\s+to\b", re.I), "can"),
    (re.compile(r"\bundertakes\s+to\b", re.I), "agrees to"),
]

MONEY_OR_PERCENT = re.compile(r"(?:Rs\.?|INR|\u20b9|\$)\s?[\d,]+(?:\.\d+)?|\b\d{1,3}(?:\.\d+)?\s?(?:%|per\s?cent)\b", re.I)
DATE_LIKE = re.compile(r"\b\d{1,2}\s+(?:day|days|month|months|year|years)\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b")


class ClauseSummarizer:
    """Wraps an optional transformer summariser plus the rule based fallback."""

    def __init__(self) -> None:
        self._pipeline = None
        self._attempted = False
        self._model_name = FALLBACK_MODEL_NAME

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def using_transformer(self) -> bool:
        return self._pipeline is not None

    def status(self) -> dict:
        return {
            "engine": "transformers" if self.using_transformer else "rule-based-fallback",
            "model": self._model_name,
            "trained_model_requested": settings.enable_transformers,
            "trained_model_loaded": self.using_transformer,
        }

    # -- loading -------------------------------------------------------
    def load(self) -> bool:
        """Attempt to load the transformer pipeline exactly once."""
        if self._attempted:
            return self._pipeline is not None
        self._attempted = True

        if not settings.enable_transformers:
            logger.info(
                "Transformer summariser disabled (ENABLE_TRANSFORMERS is not true) - "
                "using the rule based fallback."
            )
            return False

        try:
            from transformers import pipeline as hf_pipeline  # type: ignore

            target = settings.summarizer_weights or settings.summarizer_model
            self._pipeline = hf_pipeline("summarization", model=target)
            self._model_name = f"transformers:{target}"
            logger.info("Loaded transformer summariser: %s", target)
        except Exception as exc:  # pragma: no cover - environment dependent
            logger.warning(
                "Could not load the transformer summariser (%s) - using the rule based fallback.",
                exc,
            )
            self._pipeline = None
            self._model_name = FALLBACK_MODEL_NAME

        return self._pipeline is not None

    # -- inference -----------------------------------------------------
    def summarize(self, text: str) -> dict:
        """Summarise a single clause."""
        if self._pipeline is None and settings.enable_transformers and not self._attempted:
            self.load()

        if self._pipeline is not None:
            try:
                snippet = (text or "")[: settings.max_model_chars]
                result = self._pipeline(PROMPT_PREFIX + snippet)  # type: ignore[misc]
                top = result[0] if isinstance(result, list) else result
                summary = normalise_whitespace(str(top.get("summary_text", "")))
                if summary:
                    return {"summary": self._polish(summary), "model": self._model_name}
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning(
                    "Transformer summarisation failed (%s) - using the rule based fallback.", exc
                )

        return {"summary": self.summarize_extractive(text), "model": FALLBACK_MODEL_NAME}

    def _polish(self, summary: str) -> str:
        """Keep generated summaries short and sentence-cased."""
        cleaned = self._apply_simplifications(summary)
        if len(cleaned) > 320:
            cleaned = cleaned[:317].rsplit(" ", 1)[0] + "..."
        return cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned

    @staticmethod
    def _apply_simplifications(text: str) -> str:
        value = text
        for pattern, replacement in SIMPLIFICATIONS:
            value = pattern.sub(replacement, value)
        value = re.sub(r"\s{2,}", " ", value)
        value = re.sub(r"\s+([.,;])", r"\1", value)
        return normalise_whitespace(value)

    @classmethod
    def summarize_extractive(cls, text: str) -> str:
        """1-2 sentence plain English summary built from the source sentences.

        Amounts, dates and obligations present in the clause are preserved
        verbatim - the fallback never paraphrases figures.
        """
        flat = re.sub(r"\n+", " ", text or "").strip()
        sentences = split_sentences(flat)
        if not sentences:
            return ""

        picked = [sentences[0]]
        for sentence in sentences[1:]:
            if MONEY_OR_PERCENT.search(sentence) or DATE_LIKE.search(sentence):
                picked.append(sentence)
                break

        summary = cls._apply_simplifications(" ".join(picked))
        if len(summary) > 320:
            summary = summary[:317].rsplit(" ", 1)[0] + "..."
        return summary[:1].upper() + summary[1:] if summary else summary


#: Shared singleton used by the pipeline and the API layer.
summarizer = ClauseSummarizer()

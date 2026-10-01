"""Clause summarisation stage (plain-English, faithful to the source clause)."""

from __future__ import annotations

from models.summarizer import summarizer


def summarize_clauses(clauses: list[dict]) -> list[dict]:
    """Summarise every clause; returns a list aligned with the input order."""
    summaries: list[dict] = []
    for index, clause in enumerate(clauses):
        result = summarizer.summarize(clause.get("text") or "")
        summaries.append(
            {
                "index": index,
                "summary": result.get("summary") or "",
                "model": result.get("model") or summarizer.model_name,
            }
        )
    return summaries

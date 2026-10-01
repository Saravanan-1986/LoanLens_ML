"""Shared text cleaning helpers.

The same cleaning rules are implemented in the Node server
(`server/services/fallbackAnalyzer.js`) so both pipelines behave identically.
"""

from __future__ import annotations

import re

_REPEAT_THRESHOLD = 3

SENTENCE_SPLIT_RE = re.compile(r"(?<=[.;])\s+(?=[A-Z(])")


def is_likely_header(line: str) -> bool:
    """A repeated short line or an all-caps banner is almost always a page header."""
    if not line or len(line) < 20:
        return False
    letters = re.sub(r"[^A-Za-z]", "", line)
    shouty = len(letters) >= 12 and letters.isupper()
    return shouty or bool(re.match(r"page\b", line, re.IGNORECASE)) or "confidential" in line.lower()


def clean_text(raw: str) -> str:
    """Normalise whitespace and drop repeated page headers/footers."""
    if not raw:
        return ""

    text = raw.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    # Re-join words hyphenated across line breaks.
    text = re.sub(r"([a-z])-\n([a-z])", r"\1\2", text)

    lines = text.split("\n")

    counts: dict[str, int] = {}
    for line in lines:
        key = line.strip()
        if key:
            counts[key] = counts.get(key, 0) + 1

    kept: list[str] = []
    for line in lines:
        key = line.strip()
        if not key:
            continue
        seen = counts.get(key, 0)
        if seen >= _REPEAT_THRESHOLD:
            continue
        if seen >= 2 and is_likely_header(key):
            continue
        if re.fullmatch(r"page\s+\d+(\s+of\s+\d+)?", key, flags=re.IGNORECASE):
            continue
        kept.append(line)

    joined = "\n".join(kept)
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    joined = re.sub(r"[ \t]{2,}", " ", joined)
    return joined.strip()


def split_sentences(text: str) -> list[str]:
    """Split text into sentences, keeping amounts and dates intact."""
    if not text:
        return []
    return [piece.strip() for piece in SENTENCE_SPLIT_RE.split(text) if piece.strip()]


def normalise_whitespace(value: str) -> str:
    return re.sub(r"\s{2,}", " ", value or "").strip()


def count_document_chars(text: str) -> int:
    """Characters that matter (everything except whitespace)."""
    return len(re.sub(r"\s", "", text or ""))

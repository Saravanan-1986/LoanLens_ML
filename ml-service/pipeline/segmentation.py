"""Clause segmentation.

Strategy (in order):
    1. numbered sections        1., 2., 2.1, 3.4.1
    2. lettered sections        (a), (b), (c)
    3. roman sections           (i), (ii)
    4. heading detection        CLAUSE 5 / ARTICLE III / "Prepayment"
    5. sentence windows         fallback when no structure is detected

Downstream classification and summarisation always operate at clause level.
"""

from __future__ import annotations

import re

from utils.config import settings
from utils.text_clean import clean_text, count_document_chars, split_sentences

NUMBERED_LINE = re.compile(r"^\s*(\d{1,2}(?:\.\d{1,2})*)\s*[).:\-\u2013]?\s+(\S.*)$")
LETTERED_LINE = re.compile(r"^\s*\(([a-h])\)\s*[).:]?\s+(\S.*)$", re.IGNORECASE)
ROMAN_LINE = re.compile(r"^\s*\((i{1,3}|iv|v|vi{1,3}|ix|x)\)\s*[).:]?\s+(\S.*)$", re.IGNORECASE)
HEADING_HINT = re.compile(
    r"^(clause|article|section|term|condition|schedule|annexure|part)\b", re.IGNORECASE
)

MIN_CLAUSE_CHARS = 20
FALLBACK_WINDOW = 3


def detect_structure(text: str) -> dict:
    """Quick structural statistics used for the 'detect structure' stage."""
    numbered = len(re.findall(r"(?m)^\s*\d{1,2}(?:\.\d{1,2})*\s*[).:]?\s+\S", text or ""))
    lettered = len(re.findall(r"(?m)^\s*\([a-h]\)\s+\S", text or "", re.IGNORECASE))
    headings = len(
        re.findall(
            r"(?m)^\s*(?:CLAUSE|ARTICLE|SECTION|TERM|SCHEDULE)\b[^\n]{0,60}", text or "", re.IGNORECASE
        )
    )
    paragraphs = len([block for block in re.split(r"\n\s*\n", text or "") if len(block.strip()) > 60])
    return {
        "numbered_sections": numbered,
        "lettered_sections": lettered,
        "headings": headings,
        "paragraphs": paragraphs,
    }


def looks_like_heading(line: str) -> bool:
    trimmed = (line or "").strip()
    if not trimmed or len(trimmed) > 80:
        return False
    if HEADING_HINT.search(trimmed):
        return True

    letters = re.sub(r"[^A-Za-z]", "", trimmed)
    if len(letters) >= 4 and letters.isupper():
        return True

    return bool(re.match(r"^[A-Z][A-Za-z ]{3,60}$", trimmed)) and not re.search(
        r"[.;]$", trimmed
    ) and len(trimmed.split()) <= 8


def derive_title(text: str, fallback_number: int) -> str:
    first_line = (text or "").split("\n")[0].strip()
    stripped = re.sub(r"^\s*\d{1,2}(?:\.\d{1,2})*\s*[).:\-]?\s+", "", first_line)
    stripped = re.sub(r"^[^A-Za-z0-9]+", "", stripped).strip()
    source = stripped if len(stripped) >= 3 else (text or "")
    title = re.sub(r"[.,;:]$", "", " ".join(source.split()[:9]))
    if not title:
        return f"Clause {fallback_number}"
    return f"{title[:67]}..." if len(title) > 70 else title


def segment_clauses(raw_text: str) -> list[dict]:
    """Split cleaned document text into clauses."""
    text = clean_text(raw_text)
    if not text:
        return []

    lines = text.split("\n")
    clauses: list[dict] = []
    current: dict | None = None
    seen_numbered = False

    def flush() -> None:
        nonlocal current
        if current is None:
            return
        body = "\n".join(current["lines"]).strip()
        if count_document_chars(body) >= MIN_CLAUSE_CHARS:
            clauses.append(
                {
                    "index": len(clauses),
                    "clause_number": current["number"],
                    "title": current["title"] or derive_title(body, len(clauses) + 1),
                    "text": body,
                    "preamble": bool(current.get("preamble")),
                }
            )
        current = None

    for line in lines:
        numbered = NUMBERED_LINE.match(line)
        lettered = None if numbered else LETTERED_LINE.match(line)
        roman = None if (numbered or lettered) else ROMAN_LINE.match(line)
        match = numbered or lettered or roman
        is_heading = match is None and looks_like_heading(line)

        if numbered:
            seen_numbered = True

        if match:
            flush()
            heading_text = match.group(2) or ""
            current = {
                "number": match.group(1),
                "title": heading_text.strip() if looks_like_heading(heading_text) else "",
                "lines": [heading_text],
                "preamble": False,
            }
            continue

        if is_heading:
            flush()
            current = {
                "number": str(len(clauses) + 1),
                "title": line.strip(),
                "lines": [line.strip()],
                "preamble": not seen_numbered,
            }
            continue

        if current is None:
            current = {"number": "1", "title": "", "lines": [], "preamble": not seen_numbered}
        current["lines"].append(line)

    flush()

    # Drop a short document title/preamble that precedes the first numbered
    # clause so it is not reported as a risk clause of its own.
    if len(clauses) > 3 and clauses[0].get("preamble"):
        if count_document_chars(clauses[0]["text"]) < 220:
            clauses.pop(0)
        else:
            clauses[0]["title"] = "Preamble"

    # Fallback: no numbering/headings detected -> group sentences in windows.
    if len(clauses) < 3:
        sentences = split_sentences(re.sub(r"\n+", " ", text))
        grouped: list[dict] = []
        for start in range(0, len(sentences), FALLBACK_WINDOW):
            chunk = " ".join(sentences[start : start + FALLBACK_WINDOW])
            if count_document_chars(chunk) < 40:
                continue
            grouped.append(
                {
                    "index": len(grouped),
                    "clause_number": str(len(grouped) + 1),
                    "title": derive_title(chunk, len(grouped) + 1),
                    "text": chunk,
                }
            )
        if grouped:
            return grouped[: settings.max_clauses]

    cleaned_clauses = [
        {
            "index": index,
            "clause_number": clause["clause_number"],
            "title": clause["title"],
            "text": clause["text"],
        }
        for index, clause in enumerate(clauses)
        if count_document_chars(clause["text"]) >= MIN_CLAUSE_CHARS
    ]
    return cleaned_clauses[: settings.max_clauses]

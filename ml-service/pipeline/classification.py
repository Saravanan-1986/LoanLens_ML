"""Clause classification: rule engine + ML model -> combined risk decision.

The rule engine result, the ML result and the combined decision are reported
separately on every clause so the report can explain exactly where each signal
came from.
"""

from __future__ import annotations

from models.classifier import classifier
from rules.risk_rules import match_rules, rule_level

CLASSES = ["Normal", "Needs Review", "Risky"]

CLAUSE_WEIGHTS = {"Normal": 0, "Needs Review": 3, "Risky": 10}
MAX_CLAUSE_WEIGHT = 10
RISK_AMPLIFIER = 1.3
RULE_CONFIDENCE = {"HIGH": 0.92, "MEDIUM": 0.78, "LOW": 0.64}
RANK = {"Normal": 0, "Needs Review": 1, "Risky": 2}

RISK_BANDS = [(24, "Low"), (59, "Medium"), (100, "High")]

NEUTRAL_ML = {
    "classification": "Needs Review",
    "confidence": 0.5,
    "reason": "",
    "category": "Uncategorised",
    "model": "unknown",
}


def normalise_class(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().lower().replace("-", " ").replace("_", " ")
    if cleaned in {"risky", "high", "high risk"}:
        return "Risky"
    if cleaned in {"normal", "low", "low risk"}:
        return "Normal"
    if "review" in cleaned or cleaned in {"medium", "moderate", "medium risk"}:
        return "Needs Review"
    return None


def combine_clause(rule: dict | None, ml: dict | None) -> dict:
    """Merge the rule engine match with the classifier output."""
    ml_result = {**NEUTRAL_ML, **(ml or {})}
    ml_result["classification"] = normalise_class(ml_result.get("classification")) or "Needs Review"

    level = rule_level(rule)
    final_class = level if RANK[level] >= RANK[ml_result["classification"]] else ml_result["classification"]

    if rule and rule.get("severity") == "MEDIUM" and ml_result["classification"] == "Risky":
        final_class = "Risky"

    ml_confidence = float(ml_result.get("confidence") or 0.0)
    if rule is None and ml_result["classification"] == "Normal" and ml_confidence < 0.6:
        final_class = "Needs Review"

    rule_confidence = RULE_CONFIDENCE.get(rule.get("severity"), 0.6) if rule else 0.0

    reason = (
        rule.get("explanation")
        if rule
        else ml_result.get("reason")
        or "The classifier could not confidently categorise this clause, so it is listed for review."
    )

    return {
        "classification": final_class,
        "confidence": round(max(rule_confidence, ml_confidence), 2),
        "reason": reason,
        "risk_category": rule.get("category") if rule else ml_result.get("category", "Uncategorised"),
        "rule_id": rule.get("rule_id", "") if rule else "",
        "rule_severity": rule.get("severity", "") if rule else "",
        "rule_matched": bool(rule),
        "rule_name": rule.get("name", "") if rule else "",
        "rule_result": level,
        "regulatory_reference": rule.get("regulatory_reference", "") if rule else "",
        "regulatory_verified": bool(rule.get("regulatory_verified")) if rule else False,
        "ml_result": ml_result["classification"],
        "ml_confidence": round(ml_confidence, 2),
    }


def classify_clauses(clauses: list[dict]) -> list[dict]:
    """Run the rulebook and the classifier over each clause."""
    results = []
    for index, clause in enumerate(clauses):
        text = clause.get("text") or ""
        rule = match_rules(text)
        ml = classifier.predict(text)
        results.append(
            {
                "index": index,
                "rule": rule,
                "ml": ml,
                "combined": combine_clause(rule, ml),
            }
        )
    return results


def summarise_counts(clauses: list[dict]) -> dict:
    counts = {"normal": 0, "needsReview": 0, "risky": 0}
    for clause in clauses:
        value = normalise_class(clause.get("classification")) or "Needs Review"
        if value == "Risky":
            counts["risky"] += 1
        elif value == "Normal":
            counts["normal"] += 1
        else:
            counts["needsReview"] += 1
    return counts


def calculate_risk_score(clauses: list[dict]) -> int:
    """Transparent 0-100 document score (mirrors server/services/riskService.js)."""
    import math

    total = len(clauses)
    if total == 0:
        return 0

    weighted = sum(
        CLAUSE_WEIGHTS.get(normalise_class(clause.get("classification")) or "Needs Review", 0)
        for clause in clauses
    )
    ratio = weighted / (total * MAX_CLAUSE_WEIGHT)
    return max(0, min(100, math.ceil(ratio * 100 * RISK_AMPLIFIER)))


def risk_band(score: float) -> str:
    value = max(0, min(100, float(score or 0)))
    for ceiling, label in RISK_BANDS:
        if value <= ceiling:
            return label
    return "High"


def evaluate_document(clauses: list[dict]) -> dict:
    score = calculate_risk_score(clauses)
    return {
        "risk_summary": summarise_counts(clauses),
        "overall_score": score,
        "overall_risk": risk_band(score),
    }

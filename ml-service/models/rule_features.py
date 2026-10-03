"""Rule-informed engineered features for the clause risk classifier.

The public training corpora are general contract / terms-of-service text, while
LoanLens cares about a specific, well documented set of lending risks (penal
interest, foreclosure charges, unilateral rate changes, ...). Rather than hope
the n-gram model rediscovers that domain knowledge from 8k examples, this
transformer turns the *same* rulebook that the production pipeline already
trusts into explicit numeric features.

The result is concatenated with the TF-IDF word and character blocks in
``training/train_classifier.py``. Because the class is defined here (inside the
``models`` package that the ML service imports at start-up) it can be pickled
and unpickled safely by joblib.
"""

from __future__ import annotations

import re

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.base import BaseEstimator, TransformerMixin

try:  # The rulebook is pure-regex, so importing it is cheap and safe.
    from rules.risk_rules import RISK_RULES, SEVERITY_RANK
except Exception:  # noqa: BLE001 - keep the transformer usable in isolation
    RISK_RULES = []  # type: ignore[assignment]
    SEVERITY_RANK = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}

#: (rule_id, severity_rank, compiled patterns, compiled negative patterns)
_RULE_SPECS: list[tuple[str, int, list, list]] = [
    (
        rule.get("rule_id", f"rule_{index}"),
        int(SEVERITY_RANK.get(rule.get("severity", "LOW"), 1)),
        [re.compile(pattern, re.IGNORECASE) for pattern in rule.get("patterns", [])],
        [re.compile(pattern, re.IGNORECASE) for pattern in rule.get("negative_patterns", [])],
    )
    for index, rule in enumerate(RISK_RULES)
]

_AMBIGUITY_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bas\s+(?:may\s+be\s+)?(?:determined|decided|notified|amended)\b",
        r"\bfrom\s+time\s+to\s+time\b",
        r"\bsubject\s+to\s+(?:change|revision|variation)\b",
        r"\bat\s+(?:the\s+)?(?:sole\s+)?discretion\b",
        r"\bmay\s+be\s+(?:revised|altered|varied)\b",
        r"\bwithout\s+(?:prior\s+)?notice\b",
    )
]

_PERCENT = re.compile(r"\b\d{1,3}(?:\.\d+)?\s?(?:%|per\s?cent)\b", re.IGNORECASE)
_MONEY = re.compile(r"(?:Rs\.?|INR|\u20b9|\$)\s?[\d,]+(?:\.\d+)?", re.IGNORECASE)
_NUMBER = re.compile(r"\d")
_NEGATION = re.compile(r"\b(?:not|no|never|without|nor|neither)\b", re.IGNORECASE)
_SHALL = re.compile(r"\bshall\b", re.IGNORECASE)
_MAY = re.compile(r"\bmay\b", re.IGNORECASE)
_DISCRETION = re.compile(
    r"\b(?:sole\s+discretion|absolute\s+discretion|at\s+its\s+discretion|"
    r"unilateral\w*|irrevocabl\w*|conclusive|whatsoever)\b",
    re.IGNORECASE,
)
_LIABILITY = re.compile(
    r"\b(?:liab\w+|indemnif\w+|indemnit\w+|damages?|expenses?|penalt\w+)\b", re.IGNORECASE
)

#: Numeric aggregate features appended after the per-rule flags.
_AGGREGATE_NAMES = [
    "rule_match_count",
    "rule_max_severity",
    "has_high_rule",
    "has_medium_rule",
    "ambiguity_count",
    "percent_present",
    "money_present",
    "digit_present",
    "negation_count",
    "shall_count",
    "may_count",
    "discretion_terms",
    "liability_terms",
    "sentence_count",
    "word_count_scaled",
    "uppercase_ratio",
]


class RuleFeatureExtractor(BaseEstimator, TransformerMixin):
    """Turn clause text into rule-match flags plus interpretable statistics."""

    def fit(self, X, y=None):  # noqa: N803 - sklearn API
        return self

    def _features_for(self, text: str) -> list[float]:
        haystack = text or ""
        lower = haystack.lower()

        rule_flags: list[float] = []
        max_severity = 0.0
        match_count = 0.0
        for _rule_id, severity_rank, patterns, negatives in _RULE_SPECS:
            if any(pattern.search(haystack) for pattern in negatives):
                rule_flags.append(0.0)
                continue
            if any(pattern.search(haystack) for pattern in patterns):
                rule_flags.append(1.0)
                match_count += 1.0
                max_severity = max(max_severity, float(severity_rank))
            else:
                rule_flags.append(0.0)

        words = haystack.split()
        word_count = len(words)
        sentences = len([s for s in re.split(r"[.;]", haystack) if s.strip()])
        letters = [c for c in haystack if c.isalpha()]
        uppercase_ratio = (
            sum(1 for c in letters if c.isupper()) / len(letters) if letters else 0.0
        )

        aggregates = [
            match_count,
            max_severity,
            1.0 if max_severity >= 3 else 0.0,
            1.0 if max_severity == 2 else 0.0,
            float(sum(1 for pattern in _AMBIGUITY_PATTERNS if pattern.search(haystack))),
            1.0 if _PERCENT.search(haystack) else 0.0,
            1.0 if _MONEY.search(haystack) else 0.0,
            1.0 if _NUMBER.search(haystack) else 0.0,
            float(len(_NEGATION.findall(lower))),
            float(len(_SHALL.findall(lower))),
            float(len(_MAY.findall(lower))),
            float(len(_DISCRETION.findall(haystack))),
            float(len(_LIABILITY.findall(haystack))),
            float(min(sentences, 40)),
            float(min(word_count, 400)) / 100.0,
            round(uppercase_ratio, 4),
        ]

        return rule_flags + aggregates

    def transform(self, X, y=None):  # noqa: N803 - sklearn API
        # Return a sparse block so FeatureUnion keeps the fused matrix sparse
        # (a dense 400k-column matrix would not be memory safe).
        rows = [self._features_for(text) for text in X]
        return csr_matrix(np.asarray(rows, dtype=np.float64))

    def get_feature_names_out(self, input_features=None):  # noqa: N803 - sklearn API
        names = [f"rule_{spec[0]}" for spec in _RULE_SPECS]
        names.extend(_AGGREGATE_NAMES)
        return np.asarray(names, dtype=object)

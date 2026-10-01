"""LoanLens risk rulebook (Python implementation).

This mirrors `server/rules/riskRules.js` so the ML service can run a complete
analysis on its own. The Node backend is the source of truth for the persisted
score, but the rule set must stay in step between the two.

NOTE ON REGULATORY REFERENCES
-----------------------------
Rules never assert a legal conclusion. Where a rule is inspired by a published
regulatory principle the reference is stored verbatim so it can be surfaced in
the UI, together with ``regulatory_verified`` which stays ``False`` until a
human confirms the exact citation for that rule.
"""

from __future__ import annotations

import re
from functools import lru_cache

SEVERITY_HIGH = "HIGH"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_LOW = "LOW"

SEVERITY_RANK = {SEVERITY_HIGH: 3, SEVERITY_MEDIUM: 2, SEVERITY_LOW: 1}

RISK_RULES: list[dict] = [
    {
        "rule_id": "PREPAYMENT_PENALTY",
        "name": "Prepayment / Foreclosure Penalty",
        "category": "Prepayment / Foreclosure",
        "severity": SEVERITY_HIGH,
        "patterns": [
            r"pre[\s-]?pay(?:ment|ing)?[^.]{0,160}(?:charge|charges|fee|fees|penalt|percent|per cent|%)",
            r"(?:charge|charges|fee|fees|penalt\w+)[^.]{0,120}(?:pre[\s-]?pay(?:ment)?|early\s+repayment|foreclos\w+)",
            r"foreclos\w+[^.]{0,160}(?:charge|charges|fee|fees|penalt\w+|levy|levied)",
        ],
        "negative_patterns": [r"no\s+pre[\s-]?payment\s+(?:charge|penalt\w+)"],
        "explanation": (
            "This clause may impose a charge or penalty when the loan is repaid or "
            "closed before the agreed term."
        ),
        "regulatory_reference": (
            "RBI Fair Practices Code for Lenders - charges should be disclosed transparently."
        ),
        "regulatory_verified": False,
    },
    {
        "rule_id": "EXCESSIVE_PREPAYMENT_CHARGE",
        "name": "Excessive Prepayment Charge",
        "category": "Prepayment / Foreclosure",
        "severity": SEVERITY_HIGH,
        "patterns": [
            r"pre[\s-]?pay\w*[^.]{0,120}([3-9]|[1-9]\d)\s?(?:%|per\s?cent)",
            r"(?:foreclos\w+|early\s+repayment)[^.]{0,120}([3-9]|[1-9]\d)\s?(?:%|per\s?cent)",
        ],
        "negative_patterns": [],
        "explanation": (
            "A high percentage charge for repaying the loan early is flagged because it "
            "can significantly raise the effective cost of borrowing."
        ),
        "regulatory_reference": (
            "RBI guidance on transparency of prepayment charges for floating rate loans."
        ),
        "regulatory_verified": False,
    },
    {
        "rule_id": "UNCLEAR_APR",
        "name": "Unclear Effective Annual Rate",
        "category": "Interest & APR",
        "severity": SEVERITY_HIGH,
        "patterns": [
            r"(?:effective\s+annual|annual(?:ised|ized)?\s+percentage|APR|effective\s+rate)[^.]{0,140}"
            r"(?:as\s+(?:may\s+be\s+)?(?:determined|decided|notified)|at\s+(?:the\s+)?(?:sole\s+)?discretion|"
            r"from\s+time\s+to\s+time|varies?)",
            r"interest\s+rate[^.]{0,80}(?:sole\s+discretion|may\s+be\s+(?:revised|changed|altered)|"
            r"without\s+(?:prior\s+)?notice)",
        ],
        "negative_patterns": [],
        "explanation": (
            "The effective annual interest rate is not stated as a fixed number, which "
            "makes the true cost of borrowing hard to compare."
        ),
        "regulatory_reference": "RBI circular on Key Fact Statement (KFS) for retail loans.",
        "regulatory_verified": False,
    },
    {
        "rule_id": "HIDDEN_PROCESSING_FEE",
        "name": "Hidden / Non-refundable Processing Fees",
        "category": "Fees & Charges",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:processing|documentation|administrative|origination|service|handling)\s+(?:fee|fees|charge|charges)"
            r"[^.]{0,160}(?:non[\s-]?refundable|not\s+refundable|deducted|adjusted|at\s+the\s+time\s+of\s+disbursement)",
            r"non[\s-]?refundable[^.]{0,120}(?:fee|fees|charge|charges|amount)",
        ],
        "negative_patterns": [],
        "explanation": (
            "Upfront fees that are deducted at disbursement or are non-refundable reduce "
            "the amount actually received and should be checked against the quoted cost."
        ),
        "regulatory_reference": "RBI Fair Practices Code for Lenders - upfront charges must be disclosed.",
        "regulatory_verified": False,
    },
    {
        "rule_id": "EXCESSIVE_PROCESSING_CHARGE",
        "name": "Excessive Processing Charge",
        "category": "Fees & Charges",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:processing|documentation|administrative|origination)\s+(?:fee|fees|charge|charges)"
            r"[^.]{0,120}([3-9]|[1-9]\d)\s?(?:%|per\s?cent)"
        ],
        "negative_patterns": [],
        "explanation": (
            "A processing or documentation charge above 3% of the loan amount is unusually "
            "high and materially increases the cost of borrowing."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
    {
        "rule_id": "AUTO_DEBIT_MANDATE",
        "name": "Auto-debit / Mandate without Consent",
        "category": "Payment Terms",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:NACH|ECS|auto[\s-]?debit|standing\s+instruction|direct\s+debit)[^.]{0,160}"
            r"(?:without\s+(?:any\s+)?(?:prior\s+)?(?:notice|consent|authorisation|authorization)|irrevocabl\w+|unconditionally)",
            r"(?:authoris\w+|authoriz\w+)[^.]{0,80}(?:debit|deduct)\w*[^.]{0,120}"
            r"(?:without\s+(?:further\s+)?notice|at\s+any\s+time)",
            r"irrevocabl\w+[^.]{0,120}(?:mandate|instruction|authoris\w+|authoriz\w+)",
        ],
        "negative_patterns": [],
        "explanation": (
            "An automatic debit instruction described as irrevocable or effective without "
            "further notice limits the borrower's control over their bank account."
        ),
        "regulatory_reference": (
            "RBI guidelines on e-mandates / NACH requiring explicit customer authorisation."
        ),
        "regulatory_verified": False,
    },
    {
        "rule_id": "CONTACT_REFERENCES_RECOVERY",
        "name": "Recovery through Contact / Reference Persons",
        "category": "Recovery Practices",
        "severity": SEVERITY_HIGH,
        "patterns": [
            r"recover\w*[^.]{0,160}(?:contacts?|reference\s+(?:person|persons|parties)|family|relatives|employer|friends)",
            r"contacts?[^.]{0,160}(?:recover\w+|due\s+amounts|outstanding|default)",
            r"shall\s+(?:be\s+entitled\s+to\s+)?(?:contact|approach|inform)[^.]{0,120}(?:any\s+person|third\s+part|\d{10})",
        ],
        "negative_patterns": [],
        "explanation": (
            "A recovery clause that allows contacting the borrower's family, employer or "
            "reference persons is a recognised concern in debt-collection practice."
        ),
        "regulatory_reference": (
            "RBI Fair Practices Code - recovery agents must not contact third parties about a "
            "borrower's dues."
        ),
        "regulatory_verified": False,
    },
    {
        "rule_id": "UNILATERAL_INTEREST_REVISION",
        "name": "Unilateral Interest Rate Revision",
        "category": "Interest & APR",
        "severity": SEVERITY_HIGH,
        "patterns": [
            r"(?:interest\s+rate|rate\s+of\s+interest|charges?)[^.]{0,140}"
            r"(?:revised|altered|changed|modified|increased)[^.]{0,80}"
            r"(?:sole\s+discretion|without\s+(?:any\s+)?(?:prior\s+)?notice|at\s+any\s+time)",
            r"sole\s+and\s+absolute\s+discretion[^.]{0,160}(?:interest|rate|charges?|terms?)",
        ],
        "negative_patterns": [r"with\s+(?:\d+\s+days?|prior)\s+(?:written\s+)?notice"],
        "explanation": (
            "The lender reserves the right to change the interest rate or charges without real "
            "notice, so the cost of the loan may increase after signing."
        ),
        "regulatory_reference": "RBI Fair Practices Code - rate changes must be communicated to borrowers.",
        "regulatory_verified": False,
    },
    {
        "rule_id": "PENAL_INTEREST_COMPOUNDING",
        "name": "Penal Interest / Compounding",
        "category": "Penalties",
        "severity": SEVERITY_HIGH,
        "patterns": [
            r"penal\w*\s+interest[^.]{0,160}(?:compoun\w+|per\s+annum|per\s+month|monthly|daily|capitalis\w+|capitaliz\w+)",
            r"(?:compoun\w+|capitalis\w+|capitaliz\w+)[^.]{0,120}penal\w*",
            r"penal\w*\s+(?:charges?|interest)[^.]{0,140}per\s+month",
        ],
        "negative_patterns": [],
        "explanation": (
            "Penal interest that is compounded (charged on unpaid interest) grows quickly and "
            "can substantially increase the total payable amount."
        ),
        "regulatory_reference": "RBI circular on charging of penal interest and its disclosure.",
        "regulatory_verified": False,
    },
    {
        "rule_id": "BLANK_SECURITY_CHEQUE",
        "name": "Blank / Security Cheque Requirement",
        "category": "Security & Collateral",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"blank\s+(?:signed\s+)?cheque",
            r"security\s+cheque",
            r"(?:undated|blank)[^.]{0,80}cheque",
        ],
        "negative_patterns": [],
        "explanation": (
            "A blank or undated security cheque gives the lender a broad instrument that can be "
            "completed later, which borrowers should examine carefully."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
    {
        "rule_id": "CROSS_DEFAULT",
        "name": "Cross-default Clause",
        "category": "Default & Enforcement",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"cross[\s-]?default",
            r"default[^.]{0,140}(?:any\s+other|other)\s+(?:agreement|loan|facilit\w+)",
        ],
        "negative_patterns": [],
        "explanation": (
            "A default in any other agreement with the lender can automatically make this loan "
            "repayable immediately."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
    {
        "rule_id": "ACCELERATION_CLAUSE",
        "name": "Acceleration / Entire Balance Due",
        "category": "Default & Enforcement",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:entire|whole|full)\s+(?:outstanding|principal|balance|amount)[^.]{0,160}"
            r"(?:immediately\s+due|forthwith\s+due|become\s+due|callable|payable\s+immediately)",
            r"accelerat\w+[^.]{0,140}(?:loan|facility|amount|dues)",
        ],
        "negative_patterns": [],
        "explanation": (
            "On a default the lender can demand the entire remaining loan amount at once rather "
            "than only the missed instalments."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
    {
        "rule_id": "THIRD_PARTY_DATA_SHARING",
        "name": "Third-party Data Sharing",
        "category": "Data & Privacy",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:share|disclose|transfer|furnish)[^.]{0,140}(?:personal\s+(?:data|information)|information|data|details)"
            r"[^.]{0,160}(?:third\s+part\w+|affiliates?|group\s+companies|service\s+providers?|credit\s+bureau|agencies)",
            r"credit\s+(?:bureau|information\s+compan\w+)[^.]{0,160}(?:report|submit|share|furnish)",
        ],
        "negative_patterns": [],
        "explanation": (
            "Your personal or financial information may be shared with third parties, so it is "
            "worth checking which parties and for what purpose."
        ),
        "regulatory_reference": "RBI / DPDP Act expectations around borrower consent for data sharing.",
        "regulatory_verified": False,
    },
    {
        "rule_id": "WAIVER_OF_RIGHTS",
        "name": "Waiver of Rights / No Contest",
        "category": "Legal Rights",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:waive|waives|waiver)[^.]{0,160}(?:rights?|claims?|defen[cs]e|objection|dispute)",
            r"shall\s+not\s+(?:dispute|contest|challenge)",
        ],
        "negative_patterns": [],
        "explanation": (
            "The clause asks the borrower to give up legal rights or the ability to raise a "
            "dispute, which is a significant commitment."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
    {
        "rule_id": "UNFAVOURABLE_JURISDICTION",
        "name": "Distant / Unfavourable Jurisdiction",
        "category": "Legal Rights",
        "severity": SEVERITY_LOW,
        "patterns": [
            r"exclusive\s+jurisdiction",
            r"(?:jurisdiction|courts?)[^.]{0,140}(?:only|alone)",
        ],
        "negative_patterns": [],
        "explanation": (
            "Disputes must be heard only in a court chosen by the lender, which may be far from "
            "where the borrower lives."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
    {
        "rule_id": "LATE_PAYMENT_PENALTY",
        "name": "Late Payment Penalty",
        "category": "Penalties",
        "severity": SEVERITY_MEDIUM,
        "patterns": [
            r"(?:late\s+payment|delayed\s+payment|bounce|dishonou?r|overdue)[^.]{0,160}"
            r"(?:penalt\w+|charge|charges|fee|fees|\d{1,2}\s?(?:%|per\s?cent))",
            r"(?:bounce|dishonou?r)\s+charges?[^.]{0,140}(?:per\s+instance|per\s+occurrence|\d{3,5})",
        ],
        "negative_patterns": [],
        "explanation": (
            "This clause sets a penalty for late or failed payments. The amount and how it is "
            "calculated are worth verifying against the quoted terms."
        ),
        "regulatory_reference": "",
        "regulatory_verified": False,
    },
]

RULES_BY_ID: dict[str, dict] = {rule["rule_id"]: rule for rule in RISK_RULES}

#: Classification contributed by a rule match alone.
RULE_LEVEL = {"HIGH": "Risky", "MEDIUM": "Needs Review", "LOW": "Needs Review"}


@lru_cache(maxsize=1)
def _compiled_rules() -> list[dict]:
    """Compile the rulebook once, on first use."""
    compiled = []
    for rule in RISK_RULES:
        compiled.append(
            {
                "rule": rule,
                "patterns": [re.compile(p, re.IGNORECASE) for p in rule["patterns"]],
                "negative": [re.compile(p, re.IGNORECASE) for p in rule["negative_patterns"]],
            }
        )
    return compiled


def match_rules(text: str) -> dict | None:
    """Return the highest severity matching rule for a clause, or ``None``."""
    if not text or not text.strip():
        return None

    best: dict | None = None
    for entry in _compiled_rules():
        if any(pattern.search(text) for pattern in entry["negative"]):
            continue
        if not any(pattern.search(text) for pattern in entry["patterns"]):
            continue

        rule = entry["rule"]
        if best is None or SEVERITY_RANK[rule["severity"]] > SEVERITY_RANK[best["severity"]]:
            best = rule

    if best is None:
        return None

    return {
        "rule_id": best["rule_id"],
        "name": best["name"],
        "category": best["category"],
        "severity": best["severity"],
        "explanation": best["explanation"],
        "regulatory_reference": best["regulatory_reference"],
        "regulatory_verified": best["regulatory_verified"],
    }


def rule_level(rule: dict | None) -> str:
    if not rule:
        return "Normal"
    return RULE_LEVEL.get(rule["severity"], "Needs Review")


def rules_metadata() -> list[dict]:
    """Safe serialisation of the rulebook for the API/report layer."""
    return [
        {
            "rule_id": rule["rule_id"],
            "name": rule["name"],
            "category": rule["category"],
            "severity": rule["severity"],
            "explanation": rule["explanation"],
            "regulatory_reference": rule["regulatory_reference"],
            "regulatory_verified": rule["regulatory_verified"],
        }
        for rule in RISK_RULES
    ]


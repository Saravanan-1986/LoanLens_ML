"""End-to-end smoke test for the LoanLens ML pipeline.

Runs the real pipeline over a generated sample PDF and prints a summary:

    python scripts/smoke_test.py
    python scripts/smoke_test.py --pdf path/to/agreement.pdf

It exits with a non-zero status if any stage fails, so it can be used in CI.
"""

from __future__ import annotations

import argparse
import collections
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_SERVICE_DIR = os.path.join(REPO_ROOT, "ml-service")
DEFAULT_PDF = os.path.join(REPO_ROOT, "samples", "Sample_Loan_Agreement.pdf")

if ML_SERVICE_DIR not in sys.path:
    sys.path.insert(0, ML_SERVICE_DIR)


def _ensure_sample_pdf(path: str) -> str:
    if os.path.isfile(path):
        return path

    from scripts.generate_sample_pdf import build_pdf

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(build_pdf())
    print(f"Generated sample agreement at {path}")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test the LoanLens ML pipeline.")
    parser.add_argument("--pdf", default=DEFAULT_PDF, help="path to a PDF to analyse")
    args = parser.parse_args()

    from pipeline.classification import classify_clauses, evaluate_document
    from pipeline.extraction import extract_from_bytes
    from pipeline.segmentation import detect_structure, segment_clauses
    from pipeline.summarization import summarize_clauses

    pdf_path = _ensure_sample_pdf(os.path.abspath(args.pdf))
    with open(pdf_path, "rb") as handle:
        data = handle.read()

    print("\n=== 1. Extraction ===")
    extraction = extract_from_bytes(data, filename=os.path.basename(pdf_path))
    print(f"method={extraction['method']} pages={extraction['pages']} chars={extraction['characters']}")
    for warning in extraction["warnings"]:
        print(f"  warning: {warning}")

    if extraction["characters"] < 100:
        print("FAILED: not enough text was extracted.")
        return 1

    print("\n=== 2. Segmentation ===")
    clauses = segment_clauses(extraction["text"])
    print(f"clauses={len(clauses)} structure={detect_structure(extraction['text'])}")
    if not clauses:
        print("FAILED: no clauses were detected.")
        return 1

    print("\n=== 3. Risk analysis (rules + classifier) ===")
    classified = classify_clauses(clauses)
    distribution = collections.Counter(item["combined"]["classification"] for item in classified)
    matched = [item["rule"]["rule_id"] for item in classified if item["rule"]]
    print(f"distribution={dict(distribution)}")
    print(f"rule matches={len(matched)} -> {matched}")
    print(f"classifier model={classified[0]['ml']['model']}")

    print("\n=== 4. Summarisation ===")
    summaries = summarize_clauses(clauses)
    print(f"summarizer model={summaries[0]['model']}")
    for index in range(min(3, len(summaries))):
        print(f"  [{clauses[index]['clause_number']}] {summaries[index]['summary'][:150]}")

    print("\n=== 5. Document score ===")
    evaluation = evaluate_document(
        [{"classification": item["combined"]["classification"]} for item in classified]
    )
    print(
        f"score={evaluation['overall_score']} band={evaluation['overall_risk']} "
        f"summary={evaluation['risk_summary']}"
    )

    if not 0 <= evaluation["overall_score"] <= 100:
        print("FAILED: risk score out of range.")
        return 1

    print("\nOK - the LoanLens ML pipeline completed end to end.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

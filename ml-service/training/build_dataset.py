"""Build the labelled clause-risk dataset used to train the ML classifier.

Sources
-------
1. ``coastalcph/lex_glue`` **unfair_tos** - expert annotated unfair clauses from
   online consumer contracts (CLAUDETTE). Label ids:
   0 limitation of liability, 1 unilateral termination, 2 unilateral change,
   3 content removal, 4 contract by using, 5 choice of law, 6 jurisdiction,
   7 arbitration.
2. ``theatticusproject/cuad`` - 510 commercial/credit contracts with expert
   annotations for 41 clause categories. Each populated annotation cell becomes
   one training clause.
3. :mod:`training.loan_corpus` - hand written consumer loan clauses.

Labels are the three product classes: ``Normal``, ``Needs Review`` and
``Risky``. The mappings below are explicit and documented so the supervision
stays auditable.

Outputs (``ml-service/data``):
    train.jsonl, validation.jsonl, test.jsonl
    unfair_tos_test.jsonl   (external, source-native hold-out)
    dataset_report.json
"""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import random
import re
import urllib.request
from collections import Counter

import pyarrow.parquet as pq

from training.loan_corpus import LOAN_CORPUS
from training.loan_corpus_extra import EXTRA_CORPUS

ALL_LOAN_CORPUS = list(LOAN_CORPUS) + list(EXTRA_CORPUS)

HERE = pathlib.Path(__file__).resolve().parent.parent
CACHE = HERE / ".cache"
DATA = HERE / "data"

LEX_GLUE = "https://huggingface.co/datasets/coastalcph/lex_glue/resolve/main"
CUAD = (
    "https://huggingface.co/datasets/theatticusproject/cuad/resolve/main/CUAD_v1/master_clauses.csv"
)

MIN_WORDS = 12
MIN_CHARS = 90
CUAD_PER_CLASS_CAP = 4500
SEED = 20260101

#: unfair_tos label ids that describe a materially one-sided term.
UNFAIR_TOS_RISKY = {0, 1, 2, 3, 7}
#: unfair_tos label ids that need a human to judge them.
UNFAIR_TOS_REVIEW = {4, 5, 6}
UNFAIR_TOS_NAMES = {
    0: "Limitation of liability",
    1: "Unilateral termination",
    2: "Unilateral change",
    3: "Content removal",
    4: "Contract by using",
    5: "Choice of law",
    6: "Jurisdiction",
    7: "Arbitration",
}

#: CUAD category -> product risk label. Categories not listed are skipped.
CUAD_MAP: dict[str, str] = {
    # One-sided restrictions, waivers and unlimited exposure.
    "Non-Compete": "Risky",
    "Exclusivity": "Risky",
    "No-Solicit Of Customers": "Risky",
    "No-Solicit Of Employees": "Risky",
    "Non-Disparagement": "Risky",
    "Most Favored Nation": "Risky",
    "Minimum Commitment": "Risky",
    "Volume Restriction": "Risky",
    "Rofr/Rofo/Rofn": "Risky",
    "Change Of Control": "Risky",
    "Unlimited/All-You-Can-Eat-License": "Risky",
    "Irrevocable Or Perpetual License": "Risky",
    "Ip Ownership Assignment": "Risky",
    "Joint Ip Ownership": "Risky",
    "Non-Transferable License": "Risky",
    "Uncapped Liability": "Risky",
    "Liquidated Damages": "Risky",
    "Covenant Not To Sue": "Risky",
    "Post-Termination Services": "Risky",
    "Source Code Escrow": "Risky",
    "Competitive Restriction Exception": "Risky",
    # Terms that need a careful reading.
    "Governing Law": "Needs Review",
    "Renewal Term": "Needs Review",
    "Notice Period To Terminate Renewal": "Needs Review",
    "Termination For Convenience": "Needs Review",
    "Anti-Assignment": "Needs Review",
    "Revenue/Profit Sharing": "Needs Review",
    "Price Restrictions": "Needs Review",
    "Cap On Liability": "Needs Review",
    "Warranty Duration": "Needs Review",
    "Insurance": "Needs Review",
    "Third Party Beneficiary": "Needs Review",
    "Audit Rights": "Needs Review",
    "License Grant": "Needs Review",
    "Affiliate License-Licensor": "Needs Review",
    "Affiliate License-Licensee": "Needs Review",
    # Pure identification / boilerplate clauses.
    "Document Name": "Normal",
    "Parties": "Normal",
    "Agreement Date": "Normal",
    "Effective Date": "Normal",
    "Expiration Date": "Normal",
}

WHITESPACE = re.compile(r"\s+")


def clean(text: str) -> str:
    return WHITESPACE.sub(" ", (text or "").replace("\u00a0", " ")).strip()


def usable(text: str) -> bool:
    return len(text) >= MIN_CHARS and len(text.split()) >= MIN_WORDS


def fingerprint(text: str) -> str:
    return hashlib.sha1(text.lower().encode("utf-8", "ignore")).hexdigest()


def download(url: str, target: pathlib.Path) -> pathlib.Path:
    """Download ``url`` to ``target`` once, returning the cached path."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        print(f"  downloading {url}")
        urllib.request.urlretrieve(url, target)
    return target


# ---------------------------------------------------------------------------
# Source 1: unfair_tos
# ---------------------------------------------------------------------------


def load_unfair_tos() -> dict[str, list[dict]]:
    """Return the official splits of the unfair_tos dataset."""
    splits: dict[str, list[dict]] = {}
    for split in ("train", "validation", "test"):
        path = download(
            f"{LEX_GLUE}/unfair_tos/{split}-00000-of-00001.parquet",
            CACHE / "unfair_tos" / f"{split}.parquet",
        )
        table = pq.read_table(path)
        rows: list[dict] = []
        for text, labels in zip(table.column("text").to_pylist(), table.column("labels").to_pylist()):
            body = clean(text)
            if not usable(body):
                continue
            ids = [int(i) for i in (labels or [])]
            if set(ids) & UNFAIR_TOS_RISKY:
                label = "Risky"
            elif set(ids) & UNFAIR_TOS_REVIEW:
                label = "Needs Review"
            elif ids:
                label = "Needs Review"
            else:
                label = "Normal"
            names = "; ".join(UNFAIR_TOS_NAMES[i] for i in ids if i in UNFAIR_TOS_NAMES)
            rows.append(
                {
                    "text": body,
                    "label": label,
                    "source": "unfair_tos",
                    "category": names or "Standard drafting",
                }
            )
        splits[split] = rows
        print(f"  unfair_tos {split}: {len(rows)} usable clauses")
    return splits


# ---------------------------------------------------------------------------
# Source 2: CUAD
# ---------------------------------------------------------------------------


def load_cuad() -> tuple[list[dict], list[dict]]:
    """Return ``(train_rows, validation_rows)`` built from the CUAD annotations."""
    path = download(CUAD, CACHE / "cuad_master_clauses.csv")
    buckets: dict[str, list[dict]] = {"Normal": [], "Needs Review": [], "Risky": []}

    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = [c for c in (reader.fieldnames or []) if c in CUAD_MAP]
        for row in reader:
            for column in columns:
                body = clean(row.get(column, ""))
                if not usable(body):
                    continue
                label = CUAD_MAP[column]
                if len(buckets[label]) >= CUAD_PER_CLASS_CAP:
                    continue
                buckets[label].append(
                    {
                        "text": body,
                        "label": label,
                        "source": "cuad",
                        "category": column,
                    }
                )

    rng = random.Random(SEED)
    train: list[dict] = []
    validation: list[dict] = []
    for label, rows in buckets.items():
        rng.shuffle(rows)
        cut = int(len(rows) * 0.85)
        train.extend(rows[:cut])
        validation.extend(rows[cut:])
        print(f"  cuad {label}: {len(rows)} clauses")

    rng.shuffle(train)
    rng.shuffle(validation)
    return train, validation



# ---------------------------------------------------------------------------
# Source 3: the hand written loan corpus
# ---------------------------------------------------------------------------


def split_loan_corpus() -> tuple[list[dict], list[dict]]:
    rows = [
        {"text": clean(text), "label": label, "source": "loan_corpus", "category": label}
        for text, label in ALL_LOAN_CORPUS
        if usable(clean(text))
    ]
    rng = random.Random(SEED)
    rng.shuffle(rows)
    cut = int(len(rows) * 0.8)
    return rows[:cut], rows[cut:]


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------


def dedupe(*groups: list[dict]) -> list[dict]:
    seen: set[str] = set()
    kept: list[dict] = []
    for group in groups:
        for row in group:
            key = fingerprint(row["text"])
            if key in seen:
                continue
            seen.add(key)
            kept.append(row)
    return kept


def summarise(rows: list[dict]) -> dict:
    by_label = Counter(row["label"] for row in rows)
    by_source = Counter(row["source"] for row in rows)
    return {"total": len(rows), "labels": dict(by_label), "sources": dict(by_source)}


def write_jsonl(path: pathlib.Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def build() -> dict:
    print("Building the clause risk dataset ...")
    unfair = load_unfair_tos()
    cuad_train, cuad_val = load_cuad()
    loan_train, loan_val = split_loan_corpus()
    print(f"  loan_corpus: {len(loan_train) + len(loan_val)} clauses")

    train = dedupe(unfair["train"], loan_train, cuad_train)
    train_keys = {fingerprint(row["text"]) for row in train}
    validation = [
        row
        for row in dedupe(unfair["validation"], loan_val, cuad_val)
        if fingerprint(row["text"]) not in train_keys
    ]
    # Stratified in-domain test: 30% of each validation label bucket, so the
    # test set covers loan_corpus + CUAD + unfair_tos (not unfair_tos only).
    # The source-native unfair_tos hold-out is kept separately below.
    test: list[dict] = []
    kept_val: list[dict] = []
    by_label: dict[str, list[dict]] = {}
    for row in validation:
        by_label.setdefault(row["label"], []).append(row)
    for label, rows in by_label.items():
        rng_split = random.Random(f"{SEED}-{label}")
        rng_split.shuffle(rows)
        n_test = max(1, int(len(rows) * 0.30))
        test.extend(rows[:n_test])
        kept_val.extend(rows[n_test:])
    rng_final = random.Random(SEED)
    rng_final.shuffle(test)
    rng_final.shuffle(kept_val)
    validation = kept_val
    unfair_test = dedupe(unfair["test"])

    write_jsonl(DATA / "train.jsonl", train)
    write_jsonl(DATA / "validation.jsonl", validation)
    write_jsonl(DATA / "test.jsonl", test)
    write_jsonl(DATA / "unfair_tos_test.jsonl", unfair_test)

    report = {
        "train": summarise(train),
        "validation": summarise(validation),
        "test": summarise(test),
        "unfair_tos_test": summarise(unfair_test),
    }
    (DATA / "dataset_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    for split, stats in report.items():
        print(f"  {split}: {stats['total']} clauses {stats['labels']}")
    print(f"Wrote dataset to {DATA}")
    return report


if __name__ == "__main__":
    build()


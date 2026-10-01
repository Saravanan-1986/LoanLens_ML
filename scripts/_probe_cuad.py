"""Temporary probe: inspect CUAD master_clauses.csv categories."""
import csv
import pathlib
import urllib.request
from collections import Counter

ROOT = pathlib.Path(r"e:\loanLens\ml-service\.cache")
ROOT.mkdir(parents=True, exist_ok=True)
target = ROOT / "cuad_master_clauses.csv"
if not target.exists():
    print("downloading CUAD master_clauses.csv")
    urllib.request.urlretrieve(
        "https://huggingface.co/datasets/theatticusproject/cuad/resolve/main/CUAD_v1/master_clauses.csv",
        target,
    )

with target.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
    reader = csv.DictReader(handle)
    headers = reader.fieldnames
    rows = []
    for i, row in enumerate(reader):
        if i > 4000:
            break
        rows.append(row)

print("columns:", headers[:8], "... total", len(headers))
cats = Counter()
for row in rows:
    key = [h for h in headers if h and h.strip().endswith("Answer") is False and h != headers[0]]
    for h in headers:
        if h and row.get(h, "").strip() not in ("", "0", "1") and h != headers[0]:
            cats[h] += 1

print("distinct category columns:", len(cats))
for name, count in cats.most_common(60):
    print("  ", name, count)

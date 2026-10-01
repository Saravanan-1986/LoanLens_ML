"""Temporary probe: download lex_glue parquet files and inspect their schema."""
import json
import pathlib
import urllib.request
from collections import Counter

import pyarrow.parquet as pq

ROOT = pathlib.Path(r"e:\loanLens\ml-service\.cache\lex_glue")
ROOT.mkdir(parents=True, exist_ok=True)

BASE = "https://huggingface.co/datasets/coastalcph/lex_glue/resolve/main"

FILES = [
    ("unfair_tos", "train", "unfair_tos/train-00000-of-00001.parquet"),
    ("unfair_tos", "validation", "unfair_tos/validation-00000-of-00001.parquet"),
    ("ledgar", "validation", "ledgar/validation-00000-of-00001.parquet"),
]


def fetch(name, sub, url):
    target = ROOT / name / f"{sub}.parquet"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        print("downloading", url)
        urllib.request.urlretrieve(url, target)
    return target


for name, sub, url in FILES:
    path = fetch(name, sub, f"{BASE}/{url}")
    table = pq.read_table(path)
    print("==", name, sub, "rows:", table.num_rows, "cols:", table.column_names)
    row = {c: table.column(c)[0].as_py() for c in table.column_names}
    print("   sample:", json.dumps(row, default=str)[:500])
    if "labels" in table.column_names:
        labels = [v.as_py() for v in table.column("labels")]
        flat = [x for r in labels for x in (r if isinstance(r, list) else [r])]
        print("   label counts:", Counter(flat).most_common())

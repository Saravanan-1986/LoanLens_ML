"""Temporary probe: print all CUAD category columns (non -Answer)."""
import csv
import pathlib

p = pathlib.Path(r"e:\loanLens\ml-service\.cache\cuad_master_clauses.csv")
with p.open("r", encoding="utf-8", errors="ignore", newline="") as h:
    headers = next(csv.reader(h))

cats = [c for c in headers if not c.endswith("-Answer") and c != "Filename"]
print(len(cats))
for c in cats:
    print(" -", c)

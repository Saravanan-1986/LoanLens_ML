"""Temporary probe: extract LEDGAR label names from the lex_glue README."""
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(r"e:\loanLens\ml-service\.cache\lex_glue")
ROOT.mkdir(parents=True, exist_ok=True)
readme = ROOT / "README.md"
if not readme.exists():
    urllib.request.urlretrieve(
        "https://huggingface.co/datasets/coastalcph/lex_glue/resolve/main/README.md", readme
    )

text = readme.read_text(encoding="utf-8")
print("readme chars:", len(text))
for candidate in ["LEDGAR", "ledgar", "Unfair", "unfair_tos", "labels"]:
    idx = text.lower().find(candidate.lower())
    print(f"--- first '{candidate}' at {idx}")
    if idx >= 0:
        print(text[idx : idx + 700].replace("\n", " | ")[:700])

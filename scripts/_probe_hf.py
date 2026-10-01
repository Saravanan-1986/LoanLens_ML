"""Temporary probe: list lex_glue sub-dataset files."""
import json
import socket
import urllib.request

socket.setdefaulttimeout(25)


def tree(ds, rev="main", sub=""):
    url = f"https://huggingface.co/api/datasets/{ds}/tree/{rev}/{sub}".rstrip("/")
    print("==", ds, sub, "==")
    try:
        for f in json.load(urllib.request.urlopen(url)):
            print("  ", f["type"], f["path"], f.get("size", ""))
    except Exception as exc:  # noqa: BLE001
        print("   ERR", exc)


tree("coastalcph/lex_glue", sub="unfair_tos")
tree("coastalcph/lex_glue", sub="ledgar")
tree("theatticusproject/cuad", sub="CUAD_v1")

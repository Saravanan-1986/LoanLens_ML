"""Fine-tune a transformer clause-risk classifier (CPU friendly).

    python -m training.train_transformer --epochs 3

The default checkpoint (``sentence-transformers/all-MiniLM-L6-v2``) is six
layers / 22M parameters, which trains in minutes on CPU while still beating the
TF-IDF baseline on macro F1 - the metric that matters here because the classes
are imbalanced (rarest and most important: ``Risky``).

Artifacts are written to ``models/artifacts/transformer_classifier`` together
with ``transformer_metrics.json`` so the serving layer can report exactly which
model produced a prediction.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import time

import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.utils.class_weight import compute_class_weight
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = pathlib.Path(__file__).resolve().parent.parent
DATA = HERE / "data"
OUT_DIR = HERE / "models" / "artifacts" / "transformer_classifier"
METRICS_PATH = HERE / "models" / "artifacts" / "transformer_metrics.json"

LABELS = ["Normal", "Needs Review", "Risky"]
LABEL_TO_ID = {label: i for i, label in enumerate(LABELS)}
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def load_rows(name: str) -> list[dict]:
    path = DATA / f"{name}.jsonl"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


class ClauseDataset(Dataset):
    """Tokenised clause texts with their risk label ids."""

    def __init__(self, rows: list[dict], tokenizer, max_len: int) -> None:
        self.texts = [row["text"] for row in rows]
        self.labels = [LABEL_TO_ID[row["label"]] for row in rows]
        self.encodings = tokenizer(
            self.texts,
            truncation=True,
            padding="max_length",
            max_length=max_len,
            return_tensors="pt",
        )

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int) -> dict:
        item = {key: value[index] for key, value in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[index], dtype=torch.long)
        return item


def evaluate(model, loader: DataLoader) -> tuple[list[int], list[int]]:
    model.eval()
    predictions: list[int] = []
    truths: list[int] = []
    with torch.no_grad():
        for batch in loader:
            labels = batch.pop("labels")
            outputs = model(**batch)
            predictions.extend(torch.argmax(outputs.logits, dim=-1).tolist())
            truths.extend(labels.tolist())
    return truths, predictions


def report(truths: list[int], predictions: list[int], title: str) -> dict:
    names = [LABELS[i] for i in truths]
    guessed = [LABELS[i] for i in predictions]
    accuracy = accuracy_score(names, guessed)
    macro = f1_score(names, guessed, average="macro", zero_division=0)
    print(f"\n== {title} ==")
    print(f"   accuracy {accuracy:.4f}  macro-F1 {macro:.4f}")
    print(classification_report(names, guessed, zero_division=0, digits=3))
    return {
        "samples": len(names),
        "accuracy": round(float(accuracy), 4),
        "macro_f1": round(float(macro), 4),
        "per_class": classification_report(names, guessed, output_dict=True, zero_division=0),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fine-tune the transformer risk classifier")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--max-len", type=int, default=96)
    parser.add_argument("--lr", type=float, default=3e-5)
    parser.add_argument("--threads", type=int, default=0, help="0 = use all cores")
    args = parser.parse_args()

    torch.set_num_threads(args.threads or (os.cpu_count() or 4))

    train_rows = load_rows("train")
    val_rows = load_rows("validation")
    if not train_rows or not val_rows:
        print("No dataset found - run `python -m training.build_dataset` first.")
        return 1

    print(f"Loading {args.model} ...")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model, num_labels=len(LABELS)
    )

    train_ds = ClauseDataset(train_rows, tokenizer, args.max_len)
    val_ds = ClauseDataset(val_rows, tokenizer, args.max_len)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size)

    # Every clause has a rule signal already; the model must not simply learn the
    # majority class, so weight the loss by inverse class frequency.
    weights = compute_class_weight(
        "balanced", classes=np.arange(len(LABELS)), y=train_ds.labels
    )
    loss_fn = torch.nn.CrossEntropyLoss(weight=torch.tensor(weights, dtype=torch.float))
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)

    total_steps = max(1, len(train_loader) * args.epochs)
    warmup = max(1, int(total_steps * 0.1))

    def lr_at(step: int) -> float:
        if step < warmup:
            return step / warmup
        return max(0.0, (total_steps - step) / max(1, total_steps - warmup))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_at)

    best_macro = -1.0
    best_epoch = 0
    history: list[dict] = []
    global_step = 0
    started = time.perf_counter()

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        for batch in train_loader:
            labels = batch.pop("labels")
            outputs = model(**batch)
            loss = loss_fn(outputs.logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            running += float(loss.item())
            global_step += 1
            if global_step % 40 == 0:
                print(
                    f"  epoch {epoch} step {global_step}/{total_steps} "
                    f"loss {running / 40:.4f}",
                    flush=True,
                )
                running = 0.0

        truths, predictions = evaluate(model, val_loader)
        metrics = report(truths, predictions, f"epoch {epoch} validation")
        metrics["epoch"] = epoch
        history.append(metrics)
        print(f"   elapsed {time.perf_counter() - started:.0f}s", flush=True)

        if metrics["macro_f1"] > best_macro:
            best_macro = metrics["macro_f1"]
            best_epoch = epoch
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(OUT_DIR)
            tokenizer.save_pretrained(OUT_DIR)
            print(f"   saved new best model (macro F1 {best_macro:.4f})", flush=True)

    print(f"\nBest epoch {best_epoch} with validation macro F1 {best_macro:.4f}")

    # Reload the best checkpoint for the final held-out evaluation.
    served = AutoModelForSequenceClassification.from_pretrained(OUT_DIR)
    test_rows = load_rows("test")
    external_rows = load_rows("unfair_tos_test")
    final: dict = {
        "model": args.model,
        "artifact_dir": str(OUT_DIR),
        "labels": LABELS,
        "train_samples": len(train_rows),
        "validation_samples": len(val_rows),
        "best_epoch": best_epoch,
        "validation_macro_f1": round(best_macro, 4),
        "train_seconds": round(time.perf_counter() - started, 1),
        "history": history,
    }
    if test_rows:
        loader = DataLoader(ClauseDataset(test_rows, tokenizer, args.max_len), batch_size=args.batch_size)
        final["test"] = report(*evaluate(served, loader), title="test / transformer")
    if external_rows:
        loader = DataLoader(
            ClauseDataset(external_rows, tokenizer, args.max_len), batch_size=args.batch_size
        )
        final["external_unfair_tos"] = report(
            *evaluate(served, loader), title="unfair_tos hold-out / transformer"
        )

    METRICS_PATH.write_text(json.dumps(final, indent=2), encoding="utf-8")
    print(f"\nSaved transformer artifacts to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


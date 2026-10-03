"""Train and evaluate the LoanLens clause risk classifier.

Several candidate models are trained on the same features and the best one (by
macro F1 on the held-out validation split) is written to
``models/artifacts/clause_risk_classifier.joblib``.

    python -m training.train_classifier

Features   : TF-IDF word (1-3 grams) + character (3-6 grams) + rule-informed
             engineered features (models/rule_features.py) so the classifier
             inherits the documented lending-risk rulebook.
Candidates : LogisticRegression, LinearSVC (calibrated), SGD (modified_huber)
             and a soft-voting ensemble of the best learners.
Metrics    : accuracy / macro F1 / per class report on validation,
             the source-native unfair_tos test split, and our own test split.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import time

import joblib
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import VotingClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import LinearSVC

from models.rule_features import RuleFeatureExtractor

HERE = pathlib.Path(__file__).resolve().parent.parent
DATA = HERE / "data"
ARTIFACTS = HERE / "models" / "artifacts"
MODEL_PATH = ARTIFACTS / "clause_risk_classifier.joblib"
METRICS_PATH = ARTIFACTS / "metrics.json"

LABELS = ["Normal", "Needs Review", "Risky"]


def load_rows(name: str) -> list[dict]:
    path = DATA / f"{name}.jsonl"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def xy(rows: list[dict]) -> tuple[list[str], list[str]]:
    return [row["text"] for row in rows], [row["label"] for row in rows]


def build_features(max_features: int = 200_000) -> FeatureUnion:
    """Word + character TF-IDF plus rule-informed engineered features.

    The TF-IDF blocks capture surface wording while the rule block injects the
    domain knowledge encoded in the risk rulebook (penalties, foreclosure
    charges, unilateral changes, ...). Fusing the two lifts macro F1 and, in
    particular, recall on the rare and most important ``Risky`` class.
    """
    return FeatureUnion(
        [
            (
                "word",
                TfidfVectorizer(
                    lowercase=True,
                    ngram_range=(1, 3),
                    min_df=2,
                    max_features=max_features,
                    sublinear_tf=True,
                    strip_accents="unicode",
                ),
            ),
            (
                "char",
                TfidfVectorizer(
                    lowercase=True,
                    analyzer="char_wb",
                    ngram_range=(3, 6),
                    min_df=3,
                    max_features=max_features,
                    sublinear_tf=True,
                ),
            ),
            (
                "rules",
                Pipeline(
                    [
                        ("rule", RuleFeatureExtractor()),
                        # with_mean=False keeps the block sparse and FeatureUnion
                        # therefore returns a sparse fused matrix.
                        ("scale", StandardScaler(with_mean=False)),
                    ]
                ),
            ),
        ]
    )


def evaluate(model: Pipeline, texts: list[str], labels: list[str], title: str) -> dict:
    if not texts:
        return {}
    predicted = model.predict(texts)
    report = {
        "name": title,
        "samples": len(texts),
        "accuracy": round(float(accuracy_score(labels, predicted)), 4),
        "macro_f1": round(float(f1_score(labels, predicted, average="macro", zero_division=0)), 4),
        "weighted_f1": round(
            float(f1_score(labels, predicted, average="weighted", zero_division=0)), 4
        ),
        "per_class": classification_report(
            labels, predicted, output_dict=True, zero_division=0, labels=LABELS
        ),
        "confusion_matrix": confusion_matrix(labels, predicted, labels=LABELS).tolist(),
    }
    print(f"\n== {title} ==")
    print(
        f"   samples {report['samples']}  accuracy {report['accuracy']}  "
        f"macro-F1 {report['macro_f1']}  weighted-F1 {report['weighted_f1']}"
    )
    print(
        classification_report(
            labels, predicted, zero_division=0, labels=LABELS, digits=3
        )
    )
    return report


def candidates() -> dict[str, Pipeline]:
    """The model candidates compared during training (best macro F1 wins).

    Every candidate shares the fused feature space (word TF-IDF + char TF-IDF +
    rule features). Class weights are balanced because ``Risky`` is the rarest
    class yet the one we most want to catch.
    """

    def features() -> FeatureUnion:
        return build_features()

    def logreg(c_value: float) -> LogisticRegression:
        return LogisticRegression(
            C=c_value, max_iter=4000, class_weight="balanced", random_state=42
        )

    def calibrated_svc(c_value: float) -> CalibratedClassifierCV:
        return CalibratedClassifierCV(
            LinearSVC(C=c_value, class_weight="balanced", random_state=42),
            cv=3,
            method="sigmoid",
        )

    return {
        "rule+logreg-C4": Pipeline([("features", features()), ("model", logreg(4.0))]),
        "rule+logreg-C2": Pipeline([("features", features()), ("model", logreg(2.0))]),
        "rule+linearsvc-C05": Pipeline(
            [("features", features()), ("model", calibrated_svc(0.5))]
        ),
        "rule+linearsvc-C1": Pipeline(
            [("features", features()), ("model", calibrated_svc(1.0))]
        ),
        "rule+sgd-mh": Pipeline(
            [
                ("features", features()),
                (
                    "model",
                    SGDClassifier(
                        loss="modified_huber",
                        alpha=1e-5,
                        max_iter=3000,
                        class_weight="balanced",
                        random_state=42,
                    ),
                ),
            ]
        ),
        "ensemble-logreg-svc": Pipeline(
            [
                ("features", features()),
                (
                    "model",
                    VotingClassifier(
                        estimators=[
                            ("logreg", logreg(4.0)),
                            ("linearsvc", calibrated_svc(0.5)),
                        ],
                        voting="soft",
                    ),
                ),
            ]
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the clause risk classifier")
    parser.add_argument("--save", action="store_true", default=True, help="write the winning model")
    args = parser.parse_args()

    train_rows = load_rows("train")
    val_rows = load_rows("validation")
    test_rows = load_rows("test")
    external_rows = load_rows("unfair_tos_test")
    if not train_rows or not val_rows:
        print("No dataset found - run `python -m training.build_dataset` first.")
        return 1

    x_train, y_train = xy(train_rows)
    x_val, y_val = xy(val_rows)
    x_test, y_test = xy(test_rows)
    x_ext, y_ext = xy(external_rows)
    print(f"train {len(x_train)} | validation {len(x_val)} | test {len(x_test)}")

    best_name = ""
    best_model: Pipeline | None = None
    best_score = -1.0
    results: dict[str, dict] = {}

    for name, model in candidates().items():
        started = time.perf_counter()
        model.fit(x_train, y_train)
        elapsed = time.perf_counter() - started
        validation = evaluate(model, x_val, y_val, f"validation / {name}")
        validation["seconds"] = round(elapsed, 1)
        results[name] = validation
        print(f"   trained in {elapsed:.1f}s")
        if validation["macro_f1"] > best_score:
            best_score = validation["macro_f1"]
            best_name = name
            best_model = model

    assert best_model is not None
    print(f"\nWinner: {best_name} (validation macro F1 {best_score})")

    metrics = {
        "chosen_model": best_name,
        "labels": LABELS,
        "train_samples": len(x_train),
        "candidates": results,
        "test": evaluate(best_model, x_test, y_test, "test / winner"),
        "external_unfair_tos": evaluate(best_model, x_ext, y_ext, "unfair_tos hold-out / winner"),
    }

    if args.save:
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "pipeline": best_model,
                "labels": LABELS,
                "model_name": f"trained-{best_name}",
                "validation_macro_f1": best_score,
            },
            MODEL_PATH,
            compress=3,
        )
        METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        print(f"\nSaved {MODEL_PATH.name} and {METRICS_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


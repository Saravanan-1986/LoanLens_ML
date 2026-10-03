"""Risk classifier abstraction.

Priority order at inference time:

1. **Transformer** - a real HuggingFace sequence classifier. By default the
   fine-tuned checkpoint produced by ``training/train_transformer.py``
   (``models/artifacts/transformer_classifier``) is used; any HuggingFace
   checkpoint can be supplied through ``ML_CLASSIFIER_WEIGHTS``.
2. **Trained classical model** - the scikit-learn model produced by
   ``training/train_classifier.py`` (TF-IDF + linear model).
3. **Heuristic keyword fallback** - always available, and ALWAYS labelled
   ``heuristic-keyword-fallback (not a trained model)`` so the UI can separate
   rule based, ML based and fallback results honestly.
"""

from __future__ import annotations

import json
import logging
import pathlib
import re

from utils.config import settings

try:  # The rulebook is pure-regex and safe to import; used to sharpen the fallback.
    from rules.risk_rules import match_rules as _match_rules
except Exception:  # noqa: BLE001
    _match_rules = None  # type: ignore[assignment]

logger = logging.getLogger("loanlens.classifier")

LABELS = ["Normal", "Needs Review", "Risky"]

#: Root of the ml-service package (parent of ``models/``).
SERVICE_ROOT = pathlib.Path(__file__).resolve().parent.parent

TRAINED_MODEL_PREFIX = "trained"

FALLBACK_MODEL_NAME = "heuristic-keyword-fallback (not a trained model)"


def classifier_artifact_path() -> pathlib.Path:
    """Path of the scikit-learn artifact produced by ``training.train_classifier``."""
    if settings.classifier_artifact:
        return pathlib.Path(settings.classifier_artifact)
    return SERVICE_ROOT / "models" / "artifacts" / "clause_risk_classifier.joblib"


def transformer_artifact_path() -> pathlib.Path:
    """Directory of the fine-tuned transformer produced by ``training.train_transformer``."""
    if settings.transformer_artifact:
        return pathlib.Path(settings.transformer_artifact)
    return SERVICE_ROOT / "models" / "artifacts" / "transformer_classifier"


def _read_json(path: pathlib.Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 - metadata is best effort
        return {}



#: Keyword signals: (compiled pattern, weight, risk category).
HEURISTIC_SIGNALS = [
    (re.compile(r"\b(?:penalt\w+|late\s+fee|default\s+interest|penal\s+interest)\b", re.I), 4, "Penalties"),
    (re.compile(r"\b(?:foreclos\w+|pre[\s-]?payment)\b", re.I), 4, "Prepayment / Foreclosure"),
    (re.compile(r"\b(?:compoun\w+|capitalis\w+|capitaliz\w+)\b", re.I), 3, "Penalties"),
    (re.compile(r"\b(?:sole\s+discretion|without\s+notice|unilater\w+)\b", re.I), 4, "Interest & APR"),
    (re.compile(r"\b(?:irrevocabl\w+|auto[\s-]?debit|NACH|ECS)\b", re.I), 3, "Payment Terms"),
    (re.compile(r"\b(?:recover\w+|recovery\s+agent)\b", re.I), 3, "Recovery Practices"),
    (re.compile(r"\bthird\s+part\w+\b", re.I), 2, "Data & Privacy"),
    (re.compile(r"\b(?:waive|waiver|shall\s+not\s+dispute)\b", re.I), 3, "Legal Rights"),
    (re.compile(r"\b(?:cheque|guarantee|collateral|hypothecat\w+)\b", re.I), 2, "Security & Collateral"),
    (re.compile(r"\b(?:at\s+any\s+time|may\s+modify|amendment)\b", re.I), 2, "Interest & APR"),
    (re.compile(r"\b(?:non[\s-]?refundable|processing\s+fee|documentation\s+charge)\b", re.I), 2, "Fees & Charges"),
    (re.compile(r"\b(?:notwithstanding|whatsoever|hereunder)\b", re.I), 1, "Legal Rights"),
    # Additional lending-specific signals that lift fallback recall on the
    # clauses the rulebook cares about most.
    (re.compile(r"\b(?:indemnif\w+|indemnit\w+|hold\s+harmless)\b", re.I), 4, "Liability"),
    (re.compile(r"\b(?:sole\s+arbitrator|arbitration|arbitrator|arbitral)\b", re.I), 3, "Legal Rights"),
    (re.compile(r"\b(?:conclusive\s+and\s+binding|shall\s+not\s+be\s+challenged|binding\s+on\s+the\s+borrower)\b", re.I), 3, "Legal Rights"),
    (re.compile(r"\b(?:blank\s+cheque|security\s+cheque|post[\s-]?dated\s+cheque)\b", re.I), 3, "Security & Collateral"),
    (re.compile(r"\b(?:credit\s+information\s+compan\w+|credit\s+bureau|CIBIL)\b", re.I), 2, "Data & Privacy"),
    (re.compile(r"\b(?:enter\s+upon|inspect(?:ion)?\s+of\s+the\s+(?:premises|property|security))\b", re.I), 3, "Recovery Practices"),
    (re.compile(r"\b(?:assign\w*|transfer\w*)\b[^.]{0,40}\b(?:without\s+consent|at\s+its\s+discretion)\b", re.I), 3, "Legal Rights"),
    (re.compile(r"\b(?:full\s+indemnity|all\s+expenses|legal\s+expenses)\b", re.I), 2, "Liability"),
]

AMBIGUITY_SIGNALS = [
    re.compile(r"\bas\s+(?:may\s+be\s+)?(?:determined|decided|notified)\b", re.I),
    re.compile(r"\bfrom\s+time\s+to\s+time\b", re.I),
    re.compile(r"\bsubject\s+to\s+(?:change|revision)\b", re.I),
    re.compile(r"\bat\s+(?:the\s+)?(?:sole\s+)?discretion\b", re.I),
]

#: Mapping for checkpoints whose labels are the generic HuggingFace placeholders.
GENERIC_LABEL_MAP = {
    "label_0": "Normal",
    "label_1": "Needs Review",
    "label_2": "Risky",
    "normal": "Normal",
    "needs_review": "Needs Review",
    "needs review": "Needs Review",
    "risky": "Risky",
    "safe": "Normal",
    "high risk": "Risky",
    "low risk": "Normal",
    "medium risk": "Needs Review",
}


def _map_transformer_label(raw: str) -> str | None:
    """Map a model label (or LABEL_0 style id) onto the three product classes."""
    if not raw:
        return None
    cleaned = raw.strip()
    mapped = GENERIC_LABEL_MAP.get(cleaned.lower())
    if mapped:
        return mapped
    if cleaned.upper().startswith("LABEL_"):
        suffix = cleaned.split("_", 1)[1]
        if suffix.isdigit():
            index = int(suffix)
            if 0 <= index < len(LABELS):
                return LABELS[index]
    if cleaned.isdigit():
        index = int(cleaned)
        if 0 <= index < len(LABELS):
            return LABELS[index]
    return None


class RiskClassifier:
    """Wraps the transformer / trained classical model plus the heuristic fallback."""

    def __init__(self) -> None:
        self._pipeline = None
        self._trained = None
        self._trained_meta: dict = {}
        self._attempted = False
        self._trained_attempted = False
        self._worth_checked = False
        self._worth = False
        self._model_name = FALLBACK_MODEL_NAME

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def using_transformer(self) -> bool:
        return self._pipeline is not None

    @property
    def using_trained_model(self) -> bool:
        return self._trained is not None

    def status(self) -> dict:
        if self.using_transformer:
            engine = "transformers"
        elif self.using_trained_model:
            engine = "trained-classical"
        else:
            engine = "heuristic-fallback"

        return {
            "engine": engine,
            "model": self._model_name,
            "trained_model_requested": settings.enable_transformers,
            "trained_model_loaded": self.using_transformer or self.using_trained_model,
            "transformer_loaded": self.using_transformer,
            "classical_model_loaded": self.using_trained_model,
            "trained_metrics": self._trained_meta.get("metrics", {}),
        }


    # -- loading -------------------------------------------------------
    def _transformer_worth_attempting(self) -> bool:
        """Only try a transformer when it can actually beat the classical model.

        A generic checkpoint (e.g. ``distilbert-base-uncased``) has a random
        classification head, so loading it would *replace* the 90%+ accurate
        trained TF-IDF model with garbage. The transformer path is therefore
        only attempted when fine-tuned weights exist: either an explicit
        ``ML_CLASSIFIER_WEIGHTS`` or the artifact produced by
        ``training.train_transformer``. The decision is memoised so the log
        stays quiet during batch prediction.
        """
        if self._worth_checked:
            return self._worth
        self._worth_checked = True

        if not settings.enable_transformers:
            logger.info(
                "Transformer classifier disabled (ENABLE_TRANSFORMERS is not true)."
            )
            self._worth = False
        elif settings.classifier_weights:
            self._worth = True
        else:
            has_artifact = (transformer_artifact_path() / "config.json").exists()
            if not has_artifact:
                logger.info(
                    "No fine-tuned transformer weights found - using the trained "
                    "classical model instead of a generic checkpoint."
                )
            self._worth = has_artifact
        return self._worth

    def load(self) -> bool:
        """Load the best available engine.

        Order: fine-tuned transformer (only when weights exist) -> trained
        classical model -> heuristic keyword fallback (never unloaded silently;
        every engine is labelled in ``status()``).
        """
        if self._transformer_worth_attempting() and self.load_transformer():
            return True
        return self.load_trained()

    def load_transformer(self) -> bool:
        """Load the HuggingFace sequence classifier exactly once."""
        if self._attempted:
            return self._pipeline is not None
        self._attempted = True

        if not settings.enable_transformers:
            logger.info(
                "Transformer classifier disabled (ENABLE_TRANSFORMERS is not true)."
            )
            return False

        artifact = transformer_artifact_path()
        target = settings.classifier_weights or settings.classifier_model
        if not settings.classifier_weights and (artifact / "config.json").exists():
            target = str(artifact)
            metrics = _read_json(SERVICE_ROOT / "models" / "artifacts" / "transformer_metrics.json")
            self._trained_meta["metrics"] = {
                "validation_macro_f1": metrics.get("validation_macro_f1"),
                "test_accuracy": (metrics.get("test") or {}).get("accuracy"),
            }

        try:
            from transformers import pipeline as hf_pipeline  # type: ignore

            self._pipeline = hf_pipeline(
                "text-classification",
                model=target,
                tokenizer=target,
                truncation=True,
                max_length=256,
                top_k=None,
            )
            self._model_name = f"transformers:{target}"
            logger.info("Loaded transformer classifier: %s", target)
        except Exception as exc:  # pragma: no cover - environment dependent
            logger.warning(
                "Could not load the transformer classifier (%s) - trying the trained model.", exc
            )
            self._pipeline = None
            self._model_name = FALLBACK_MODEL_NAME

        return self._pipeline is not None

    def load_trained(self) -> bool:
        """Load the scikit-learn artifact produced by the training pipeline."""
        if self._trained_attempted:
            return self._trained is not None
        self._trained_attempted = True

        path = classifier_artifact_path()
        if not path.exists():
            logger.info(
                "No trained classical model at %s - using the heuristic fallback.", path
            )
            return False

        try:
            import joblib  # type: ignore

            bundle = joblib.load(path)
            self._trained = bundle["pipeline"]
            metrics_path = SERVICE_ROOT / "models" / "artifacts" / "metrics.json"
            metrics = _read_json(metrics_path)
            chosen = metrics.get("chosen_model", "unknown")
            self._trained_meta["metrics"] = {
                "chosen_model": chosen,
                "validation_accuracy": (metrics.get("candidates", {}).get(chosen) or {}).get(
                    "accuracy"
                ),
                "validation_macro_f1": (metrics.get("candidates", {}).get(chosen) or {}).get(
                    "macro_f1"
                ),
                "test_accuracy": (metrics.get("test") or {}).get("accuracy"),
            }
            self._model_name = bundle.get("model_name", f"{TRAINED_MODEL_PREFIX}-{chosen}")
            logger.info("Loaded trained clause classifier: %s", self._model_name)
            return True
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Could not load the trained classifier (%s).", exc)
            self._trained = None
            return False


    # -- inference -----------------------------------------------------
    def predict(self, text: str) -> dict:
        """Classify a single clause with the best available engine."""
        if (
            self._pipeline is None
            and not self._attempted
            and self._transformer_worth_attempting()
        ):
            self.load_transformer()
        if self._pipeline is None and self._trained is None and not self._trained_attempted:
            self.load_trained()

        if self._pipeline is not None:
            try:
                return self._predict_transformer(text)
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning(
                    "Transformer inference failed (%s) - using the next engine.", exc
                )

        if self._trained is not None:
            try:
                return self.predict_trained(text)
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning(
                    "Trained model inference failed (%s) - using the heuristic fallback.", exc
                )

        return self.predict_heuristic(text)

    def predict_trained(self, text: str) -> dict:
        """Predict with the trained scikit-learn model (returns real probabilities)."""
        model = self._trained
        snippet = (text or "")[: settings.max_model_chars]
        probabilities = model.predict_proba([snippet])[0]
        classes = list(model.classes_)

        best_index = int(max(range(len(probabilities)), key=lambda i: probabilities[i]))
        label = classes[best_index]
        confidence = float(probabilities[best_index])

        # A narrow margin between the top two classes means the wording is
        # genuinely ambiguous, so we surface it for human review.
        ordered = sorted(probabilities, reverse=True)
        margin = ordered[0] - (ordered[1] if len(ordered) > 1 else 0.0)
        if label == "Normal" and (confidence < 0.55 or margin < 0.12):
            label = "Needs Review"

        runner_up = classes[
            max((i for i in range(len(probabilities)) if i != best_index), key=lambda i: probabilities[i])
        ] if len(probabilities) > 1 else ""

        return {
            "classification": label,
            "confidence": round(confidence, 2),
            "reason": (
                f"The trained clause-risk model classified this clause as '{label}' "
                f"({confidence * 100:.0f}% probability, next best '{runner_up}')."
            ),
            "category": "Model Prediction",
            "model": self._model_name,
            "probabilities": {
                str(classes[i]): round(float(probabilities[i]), 4) for i in range(len(classes))
            },
        }

    def _predict_transformer(self, text: str) -> dict:
        snippet = (text or "")[: settings.max_model_chars]
        result = self._pipeline(snippet)  # type: ignore[misc]

        # ``top_k=None`` returns [[{label, score}, ...]]; the default pipeline
        # returns [{label, score}]. Normalise both shapes.
        if isinstance(result, list) and result and isinstance(result[0], list):
            scores = result[0]
        elif isinstance(result, list):
            scores = result
        else:  # pragma: no cover - defensive
            scores = [result]

        probabilities: dict[str, float] = {}
        for entry in scores:
            raw = str(entry.get("label", "")).strip()
            mapped = _map_transformer_label(raw)
            if mapped is None:
                continue
            probabilities[mapped] = max(probabilities.get(mapped, 0.0), float(entry.get("score", 0.0)))

        if not probabilities:
            return self.predict_heuristic(text)

        top = max(probabilities, key=lambda key: probabilities[key])
        confidence = probabilities[top]

        # Transformers are over-confident on short clauses; ask for a human pass
        # when the top two classes are close together.
        ordered = sorted(probabilities.values(), reverse=True)
        margin = ordered[0] - (ordered[1] if len(ordered) > 1 else 0.0)
        label = top
        if top == "Normal" and (confidence < 0.6 or margin < 0.15):
            label = "Needs Review"

        return {
            "classification": label,
            "confidence": round(confidence, 2),
            "reason": f"The {self._model_name} sequence classifier predicted '{label}' for this clause.",
            "category": "Model Prediction",
            "model": self._model_name,
            "probabilities": {key: round(value, 4) for key, value in probabilities.items()},
        }


    @staticmethod
    def predict_heuristic(text: str) -> dict:
        """Transparent keyword/heuristic classifier used as the fallback.

        It deliberately reuses the documented rulebook so that, even with no
        trained model available, the labels agree with the rules the product
        already applies and the reported category is meaningful.
        """
        haystack = text or ""
        score = 0
        category = "Uncategorised"
        top_weight = 0

        for pattern, weight, signal_category in HEURISTIC_SIGNALS:
            if pattern.search(haystack):
                score += weight
                if weight > top_weight:
                    top_weight = weight
                    category = signal_category

        rule = _match_rules(haystack) if _match_rules else None
        if rule:
            severity = rule.get("severity", "LOW")
            score += {"HIGH": 5, "MEDIUM": 3}.get(severity, 2)
            if category == "Uncategorised" or severity == "HIGH":
                category = rule.get("category", category)

        ambiguous = any(pattern.search(haystack) for pattern in AMBIGUITY_SIGNALS)
        if ambiguous:
            score += 1
            if category == "Uncategorised":
                category = "Ambiguous Wording"

        word_count = len(haystack.split())

        if score >= 5:
            classification = "Risky"
        elif score >= 2:
            classification = "Needs Review"
        else:
            classification = "Normal"

        if word_count < 8 and classification == "Normal":
            classification = "Needs Review"

        # Confidence baseline: a clause with no risk signals and enough words is
        # confidently "Normal"; anything touching a signal is progressively less sure.
        if score == 0:
            confidence = 0.72 if word_count >= 8 else 0.5
        elif score == 1:
            confidence = 0.62
        else:
            confidence = min(0.93, 0.6 + score * 0.05)

        if ambiguous:
            confidence = max(0.45, confidence - 0.06)

        reasons = {
            "Risky": (
                f"The heuristic classifier detected {category.lower()} language that commonly "
                "appears in clauses borrowers should check closely."
            ),
            "Needs Review": (
                "The wording is ambiguous or contains terms that cannot be judged confidently "
                "without a closer reading."
            ),
            "Normal": "No notable risk keywords were detected in this clause.",
        }

        return {
            "classification": classification,
            "confidence": round(confidence, 2),
            "reason": reasons[classification],
            "category": category,
            "model": FALLBACK_MODEL_NAME,
        }


#: Shared singleton used by the pipeline and the API layer.
classifier = RiskClassifier()

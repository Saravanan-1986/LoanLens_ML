"""LoanLens ML service - FastAPI application.

Run with:
    cd ml-service
    uvicorn app:app --reload --port 8000

The service exposes document extraction (PDF + OCR), clause segmentation, the
rule engine, classification and summarisation. It is deliberately decoupled
from the Node API so models can be swapped without touching the frontend.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.classifier import classifier
from models.summarizer import summarizer
from routes import analyze, health
from rules.risk_rules import RISK_RULES
from utils.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-5s %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("loanlens")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Warm up models once, at startup (trained sklearn loads by default)."""
    logger.info("Starting %s v%s", settings.service_name, settings.version)
    logger.info("Rulebook loaded with %d rules", len(RISK_RULES))

    classifier.load()
    summarizer.load()
    if classifier.using_transformer or summarizer.using_transformer:
        logger.info(
            "Transformer backend active (classifier=%s summarizer=%s)",
            classifier.model_name,
            summarizer.model_name,
        )
    elif classifier.using_trained_model:
        logger.info(
            "Trained classical classifier active: %s (summarizer=%s). "
            "Set ENABLE_TRANSFORMERS=true once transformer weights are available.",
            classifier.model_name,
            summarizer.model_name,
        )
    else:
        logger.info(
            "No trained models available - classifier and summariser will use their "
            "clearly-labelled fallbacks."
        )

    yield
    logger.info("Shutting down %s", settings.service_name)


app = FastAPI(
    title="LoanLens ML Service",
    version=settings.version,
    description=(
        "Document extraction (PDF/OCR), clause segmentation, rule based risk detection, "
        "risk classification and plain-English summarisation for LoanLens. "
        "LoanLens is an awareness and screening tool and does not provide legal advice."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "service": settings.service_name,
        "version": settings.version,
        "disclaimer": (
            "LoanLens is an awareness and screening tool. It does not provide legal advice."
        ),
        "endpoints": [
            "GET  /health",
            "POST /extract",
            "POST /segment",
            "POST /classify",
            "POST /summarize",
            "POST /analyze",
            "GET  /rules",
            "GET  /engine",
        ],
        "docs": "/docs",
    }

"""Bantay-Dagitab FastAPI ML service.

Per paper §IV.C, this service hosts ML inference workloads — anomaly
detection and forecasting — separately from the request-serving tier.
The chatbot is NOT in this service; the Django backend calls the
external LLM API directly (paper §IV.B, §VII.A.4).

Currently only the /health endpoint is implemented. The anomaly
detection (Contract C) and forecasting routers will be added under
app/routers/ when those subsystems are built.
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

logging.basicConfig(
    level=logging.INFO if os.environ.get("DEBUG") else logging.WARNING,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Bantay-Dagitab ML Service",
    description=(
        "FastAPI ML service hosting (future) anomaly detection (Contract C) "
        "and load forecasting per paper §IV.C / Table IV.C.2."
    ),
    version="0.1.0",
)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}

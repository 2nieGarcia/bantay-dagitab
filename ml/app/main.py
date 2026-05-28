"""Bantay-Dagitab FastAPI ML service.

Per paper §IV.C, this service hosts ML inference workloads — anomaly
detection and (future) forecasting — separately from the request-serving
tier. The chatbot is NOT in this service; the Django backend calls the
external LLM API directly (paper §IV.B, §VII.A.4).

Exposed surface:

  GET  /health             — liveness probe
  POST /anomaly/run-once   — one pass of the inference worker, gated by
                             X-Service-Token (paper §VI.F.2). The Django
                             backend's /api/iot/run-ml/ proxy forwards
                             frontend "Run inference now" clicks here.

Inference itself remains the cron-style worker described in
ARCHITECTURE §6 "Baseline"; this endpoint is a manual trigger over the
same shared code path (`src.inference.inference_worker.run_one_pass`).
"""

import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, status

load_dotenv()

logging.basicConfig(
    level=logging.INFO if os.environ.get("DEBUG") else logging.WARNING,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Bantay-Dagitab ML Service",
    description=(
        "FastAPI ML service hosting anomaly detection (Contract C) per "
        "paper §IV.C / Table IV.C.2."
    ),
    version="0.2.0",
)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


def _require_service_token(x_service_token: Optional[str]) -> None:
    expected = os.environ.get("SERVICE_ACCOUNT_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SERVICE_ACCOUNT_TOKEN is not configured on the ML service.",
        )
    if not x_service_token or x_service_token != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing X-Service-Token.",
        )


@app.post("/anomaly/run-once", tags=["inference"])
def run_anomaly_once(
    x_service_token: Optional[str] = Header(default=None, alias="X-Service-Token"),
) -> dict:
    """Trigger a single inference pass and return summary stats.

    Reads new readings from Django's iot_monitoring_iotreading, scores
    them, writes per-row observability to ml_predictions_log, advances
    the cursor, and pushes any sustained-3 triggers to Django's Contract
    C ingest endpoint. Same code path as the CLI worker.
    """
    _require_service_token(x_service_token)

    # Import lazily so the FastAPI app starts even if ML deps haven't
    # finished compiling yet during a cold container build.
    from src.inference.inference_worker import run_one_pass

    try:
        summary = run_one_pass()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    return summary

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
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, status

load_dotenv()

logging.basicConfig(
    level=logging.INFO if os.environ.get("DEBUG") else logging.WARNING,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
LOGGER = logging.getLogger("ml.app")

app = FastAPI(
    title="Bantay-Dagitab ML Service",
    description=(
        "FastAPI ML service hosting anomaly detection (Contract C) per "
        "paper §IV.C / Table IV.C.2."
    ),
    version="0.2.0",
)


# Path to the ML-owned observability schema (paper §VII.A.5 "predictions
# log"). The file is shipped in-repo alongside this app; we apply it on
# startup so a fresh Supabase project doesn't 500 the first /anomaly/run-once
# call with `relation "ml_worker_state" does not exist`. All statements are
# IF NOT EXISTS, so this is safe to run on every boot.
_OBSERVABILITY_SQL = Path(__file__).resolve().parent.parent / "ml_observability_tables.sql"


@app.on_event("startup")
def ensure_observability_tables() -> None:
    if not _OBSERVABILITY_SQL.exists():
        LOGGER.warning("Observability SQL not found at %s; skipping bootstrap.", _OBSERVABILITY_SQL)
        return
    try:
        from sqlalchemy import text

        from src.db import get_engine
    except Exception as exc:
        LOGGER.warning("ML observability bootstrap skipped (import failed): %s", exc)
        return

    sql = _OBSERVABILITY_SQL.read_text(encoding="utf-8")
    try:
        with get_engine().begin() as conn:
            conn.execute(text(sql))
        LOGGER.info("ml_worker_state and ml_predictions_log ensured.")
    except Exception as exc:
        # Don't crash the app — operators can apply the SQL manually if the
        # automated path fails (e.g., read-only DB role in some environments).
        LOGGER.error("Failed to ensure ML observability tables: %s", exc)


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
        summary = run_one_pass(skip_to_recent=True)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    return summary

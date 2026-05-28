"""Inference worker — cron-driven anomaly detection.

Paper §IV.C / ARCHITECTURE §6 (Baseline). One pass of this worker:

  1. Reads IoT readings from Django's `iot_monitoring_iotreading` table.
     A cursor stored in `ml_worker_state.last_processed_reading_id` is
     advanced after each run so only new rows are scored.
  2. For every reading, computes a predicted wattage using the deployed
     model (joblib artifact at deployment.model_path) and the same
     feature set built during training.
  3. Applies the k·σ threshold and the sustained-3 rule (paper §IV.C).
  4. Writes one row to `ml_predictions_log` per reading (observability).
  5. For each sustained-3 trigger, pushes a Contract C payload to
     Django's `POST /api/analytics/ingest/` (paper §VI.F.2,
     X-Service-Token auth).

Run via:

    python -m src.inference.run worker --config config/deployment.yaml
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import yaml
from sqlalchemy import bindparam, text

from src.db import get_engine
from src.django_client import DjangoAlertPushError, is_configured as django_configured, push_anomaly_alert


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOGGER = logging.getLogger("inference_worker")

WORKER_STATE_CURSOR_KEY = "last_processed_reading_id"


@dataclass
class Threshold:
    k: float
    sigma_residuals: float


def setup_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    LOGGER.addHandler(handler)
    LOGGER.setLevel(getattr(logging, level.upper(), logging.INFO))


def load_config(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def load_thresholds(raw: Dict) -> Tuple[Threshold, Dict[str, Threshold]]:
    thresholds = raw.get("thresholds", {})
    default_cfg = thresholds.get("default", {"k": 3.0, "sigma_residuals": 100.0})
    default = Threshold(
        k=float(default_cfg.get("k", 3.0)),
        sigma_residuals=float(default_cfg.get("sigma_residuals", 100.0)),
    )
    by_device: Dict[str, Threshold] = {}
    for device_id, cfg in thresholds.items():
        if device_id == "default":
            continue
        by_device[device_id] = Threshold(
            k=float(cfg.get("k", default.k)),
            sigma_residuals=float(cfg.get("sigma_residuals", default.sigma_residuals)),
        )
    return default, by_device


def fetch_cursor(engine) -> int:
    """Read `last_processed_reading_id` from ml_worker_state; default 0."""
    query = text("SELECT value FROM ml_worker_state WHERE key = :key")
    with engine.connect() as conn:
        row = conn.execute(query, {"key": WORKER_STATE_CURSOR_KEY}).fetchone()
    if row is None:
        return 0
    try:
        return int(row[0])
    except (TypeError, ValueError):
        return 0


def fetch_unprocessed(engine, cursor_id: int, limit: int) -> pd.DataFrame:
    """Read Django's iot_monitoring_iotreading rows newer than the cursor.

    Columns returned match the worker's downstream expectations:
      id, device_id, user_account_id, timestamp, avg_wattage
    `user_account_id` is sourced from Django's integer FK `user_id`.
    """
    query = text(
        """
        SELECT r.id,
               r.device_id,
               u.username     AS user_account_id,
               r.timestamp,
               r.avg_wattage
        FROM iot_monitoring_iotreading r
        JOIN auth_user u ON r.user_id = u.id
        WHERE r.id > :cursor_id
        ORDER BY r.id ASC
        LIMIT :limit
        """
    )
    return pd.read_sql_query(
        query,
        engine,
        params={"cursor_id": cursor_id, "limit": limit},
    )


def fetch_device_means(
    engine,
    device_ids: Iterable[str],
    cursor_id: int,
    lookback_limit: int = 2000,
) -> Dict[str, float]:
    """Per-device mean wattage over readings persisted *before* this batch.

    Restricting to ``id <= cursor_id`` is what makes the fallback predictor
    actually predictive: without it, the spike rows being scored sit inside
    their own baseline and residual collapses to ~0. With it, the baseline
    is the household's pre-spike behaviour. Returns an empty dict for
    devices with no prior history; callers should treat that as "no
    baseline yet" and default predicted to 0 W, not to the current reading.

    ``lookback_limit`` caps the scan to the most recent N rows before the
    cursor to avoid full-table scans on large datasets over remote DB
    connections.
    """
    if not device_ids:
        return {}
    floor_id = max(0, cursor_id - lookback_limit)
    query = text(
        """
        SELECT device_id, AVG(avg_wattage) AS mean_wattage
        FROM iot_monitoring_iotreading
        WHERE device_id IN :device_ids
          AND id > :floor_id
          AND id <= :cursor_id
        GROUP BY device_id
        """
    ).bindparams(bindparam("device_ids", expanding=True))
    df = pd.read_sql_query(
        query,
        engine,
        params={"device_ids": list(device_ids), "cursor_id": cursor_id, "floor_id": floor_id},
    )
    return {row["device_id"]: float(row["mean_wattage"]) for _, row in df.iterrows()}


def fetch_recent_history(
    engine,
    device_ids: Iterable[str],
    cutoff: datetime,
) -> Dict[str, pd.DataFrame]:
    if not device_ids:
        return {}
    query = text(
        """
        SELECT device_id, timestamp, avg_wattage
        FROM iot_monitoring_iotreading
        WHERE device_id IN :device_ids
          AND timestamp >= :cutoff
        ORDER BY device_id, timestamp ASC
        """
    ).bindparams(bindparam("device_ids", expanding=True))
    df = pd.read_sql_query(
        query,
        engine,
        params={"device_ids": list(device_ids), "cutoff": cutoff},
    )
    if df.empty:
        return {}
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    history: Dict[str, pd.DataFrame] = {}
    for device_id, group in df.groupby("device_id"):
        history[device_id] = group.sort_values("timestamp").reset_index(drop=True)
    return history


def load_model_payload(model_path: str) -> Dict:
    payload = joblib.load(model_path)
    if not isinstance(payload, dict) or "model" not in payload:
        raise ValueError("Model artifact missing 'model' payload")
    return payload


def build_feature_row(
    history_df: Optional[pd.DataFrame],
    timestamp: pd.Timestamp,
    avg_wattage: float,
    feature_cols: List[str],
) -> Optional[pd.DataFrame]:
    if history_df is None:
        return None

    df = history_df.copy()
    df = df.sort_values("timestamp").reset_index(drop=True)
    new_row = {
        "timestamp": pd.to_datetime(timestamp, utc=True),
        "avg_wattage": float(avg_wattage),
    }
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

    df["lag_1"] = df["avg_wattage"].shift(1)
    df["lag_2"] = df["avg_wattage"].shift(2)
    df["lag_4"] = df["avg_wattage"].shift(4)
    df["lag_96"] = df["avg_wattage"].shift(96)

    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    df["rolling_mean_4"] = df["avg_wattage"].rolling(window=4, min_periods=1).mean()
    df["rolling_std_4"] = df["avg_wattage"].rolling(window=4, min_periods=1).std()

    hour_median = df.groupby(df["timestamp"].dt.hour)["avg_wattage"].median()
    df["hour_median"] = df["hour"].map(hour_median)
    df["hour_median"] = df["hour_median"].fillna(df["avg_wattage"].median())

    df["rolling_mean_24h"] = df["avg_wattage"].rolling(window=96, min_periods=1).mean()
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24.0)
    df["day_of_week_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7.0)
    df["day_of_week_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7.0)
    df["reading_interval_minutes"] = 15

    last_row = df.iloc[-1:]
    if last_row.empty:
        return None

    row_features = last_row[feature_cols].fillna(0)
    return row_features


def load_consecutive_counts(engine, device_ids: Iterable[str]) -> Dict[str, int]:
    device_ids = list(device_ids)
    if not device_ids:
        return {}
    keys = [f"consecutive_{device_id}" for device_id in device_ids]
    query = text(
        """
        SELECT key, value
        FROM ml_worker_state
        WHERE key IN :keys
        """
    ).bindparams(bindparam("keys", expanding=True))
    df = pd.read_sql_query(query, engine, params={"keys": keys})
    counts: Dict[str, int] = {device_id: 0 for device_id in device_ids}
    for _, row in df.iterrows():
        key = row["key"]
        device_id = key.replace("consecutive_", "")
        try:
            counts[device_id] = int(row["value"])
        except (TypeError, ValueError):
            counts[device_id] = 0
    return counts


def upsert_worker_state(conn, payload: List[Dict]) -> None:
    if not payload:
        return
    query = text(
        """
        INSERT INTO ml_worker_state (key, value)
        VALUES (:key, :value)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """
    )
    conn.execute(query, payload)


def insert_predictions(conn, rows: List[Dict]) -> None:
    if not rows:
        return
    query = text(
        """
        INSERT INTO ml_predictions_log (
            timestamp,
            device_id,
            actual_wattage,
            predicted_wattage,
            residual_wattage,
            alert_triggered,
            created_at
        ) VALUES (
            :timestamp,
            :device_id,
            :actual_wattage,
            :predicted_wattage,
            :residual_wattage,
            :alert_triggered,
            :created_at
        )
        """
    )
    conn.execute(query, rows)


def _format_expected_range(predicted: float, threshold: float) -> str:
    low = max(0.0, predicted - threshold)
    high = predicted + threshold
    return f"{low:.0f}-{high:.0f}"


def _build_alert_message(actual: float, predicted: float) -> str:
    if predicted <= 0:
        return (
            "Warning: Your current usage is higher than expected for this time "
            "of day. Check appliances to avoid bill shock at end of billing cycle."
        )
    pct = int(round(((actual - predicted) / predicted) * 100))
    return (
        "Warning: Your current usage is "
        f"{pct}% higher than your historical average for this time of day. "
        "Check appliances to avoid bill shock at end of billing cycle."
    )


def _build_contract_c_payload(
    *,
    user_account_id: str,
    device_id: str,
    timestamp: datetime,
    actual: float,
    predicted: float,
    threshold: float,
) -> Dict:
    if isinstance(timestamp, pd.Timestamp):
        ts_iso = timestamp.tz_convert("UTC").isoformat() if timestamp.tzinfo else timestamp.tz_localize("UTC").isoformat()
    elif isinstance(timestamp, datetime):
        ts = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
        ts_iso = ts.isoformat()
    else:
        ts_iso = str(timestamp)
    return {
        "user_account_id": user_account_id,
        "device_id": device_id,
        "timestamp": ts_iso,
        "alert_type": "SUSTAINED_OVER_CONSUMPTION",
        "expected_wattage_range": _format_expected_range(predicted, threshold),
        "actual_wattage": float(actual),
        "message": _build_alert_message(actual, predicted),
    }


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inference worker")
    parser.add_argument(
        "--config",
        type=str,
        default=str(PROJECT_ROOT / "config" / "deployment.yaml"),
        help="Path to deployment config",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    return parser


def run_one_pass(
    config_path: Optional[str] = None,
    *,
    skip_to_recent: bool = False,
) -> Dict[str, object]:
    """Execute a single inference cycle and return a summary.

    Shared implementation between the CLI (``python -m src.inference.run worker``)
    and the FastAPI endpoint ``POST /anomaly/run-once``. Raises RuntimeError if
    Django push is not configured — callers should surface that to the user.

    Parameters
    ----------
    skip_to_recent : bool
        When *True*, fast-forward the cursor to ``MAX(id) - batch_size``
        before reading. This lets API-triggered runs (simulator "Spike +
        run inference") score only the most recent readings instead of
        grinding through the entire historical backlog.
    """
    if config_path is None:
        config_path = str(PROJECT_ROOT / "config" / "deployment.yaml")

    config = load_config(config_path)
    deployment_cfg = config.get("deployment", {})
    inference_cfg = config.get("inference", {})
    anomaly_cfg = config.get("anomaly", {})
    thresholds_default, thresholds_by_device = load_thresholds(anomaly_cfg)

    batch_size = int(inference_cfg.get("batch_size", 1000))
    sustained_window = int(anomaly_cfg.get("sustained_window", 3))
    history_days = int(inference_cfg.get("history_days", 7))

    if not django_configured():
        raise RuntimeError(
            "Django push not configured. Set BACKEND_API_URL and "
            "SERVICE_ACCOUNT_TOKEN before running the worker."
        )

    model = None
    feature_cols: List[str] = []
    model_path = deployment_cfg.get("model_path")
    if model_path:
        try:
            model_payload = load_model_payload(str(PROJECT_ROOT / model_path))
            model = model_payload.get("model")
            feature_cols = list(model_payload.get("feature_cols", []))
            LOGGER.info("Loaded model: %s", model_path)
        except Exception as exc:
            LOGGER.warning("Failed to load model (%s): %s", model_path, exc)

    engine = get_engine()

    LOGGER.info("Loading new readings...")
    cursor_id = fetch_cursor(engine)

    # --- skip-to-recent: jump cursor near the tail of the table ----------
    if skip_to_recent:
        with engine.connect() as conn:
            max_id_row = conn.execute(
                text("SELECT MAX(id) FROM iot_monitoring_iotreading")
            ).fetchone()
        max_id = max_id_row[0] if max_id_row and max_id_row[0] else 0
        target_cursor = max(0, max_id - batch_size)
        if target_cursor > cursor_id:
            LOGGER.info(
                "skip_to_recent: advancing cursor %s → %s (max_id=%s)",
                cursor_id, target_cursor, max_id,
            )
            # Reset consecutive counters — they're stale after a big jump.
            with engine.begin() as conn:
                conn.execute(text(
                    "DELETE FROM ml_worker_state WHERE key LIKE 'consecutive_%'"
                ))
                upsert_worker_state(conn, [
                    {"key": WORKER_STATE_CURSOR_KEY, "value": str(target_cursor)},
                ])
            cursor_id = target_cursor
    readings = fetch_unprocessed(engine, cursor_id, batch_size)
    model_loaded = model is not None and bool(feature_cols)
    predictor_mode = "model" if model_loaded else "device_mean_baseline"

    if readings.empty:
        LOGGER.info("No new readings found (cursor=%s).", cursor_id)
        return {
            "processed": 0,
            "alerts_triggered": 0,
            "pushed": 0,
            "push_failures": 0,
            "cursor": cursor_id,
            "skipped_no_readings": True,
            "model_loaded": model_loaded,
            "predictor_mode": predictor_mode,
        }

    device_ids = sorted(readings["device_id"].unique())
    device_means = fetch_device_means(engine, device_ids, cursor_id)
    history_cutoff = datetime.now(timezone.utc) - pd.Timedelta(days=history_days)
    history_by_device = fetch_recent_history(engine, device_ids, history_cutoff)
    consecutive_counts = load_consecutive_counts(engine, device_ids)

    prediction_rows: List[Dict] = []
    alert_payloads: List[Dict] = []
    now = datetime.now(timezone.utc)

    for _, row in readings.iterrows():
        device_id = row["device_id"]
        user_account_id = row["user_account_id"]
        actual = float(row["avg_wattage"])
        # No-history fallback: treat predicted as 0 W (not as `actual`).
        # If we mirror `actual`, residual collapses to 0 and a brand-new
        # device can never raise its first anomaly.
        predicted = device_means.get(device_id, 0.0)
        if model is not None and feature_cols:
            history_df = history_by_device.get(device_id)
            feature_row = build_feature_row(
                history_df,
                pd.to_datetime(row["timestamp"], utc=True),
                actual,
                feature_cols,
            )
            if feature_row is not None:
                try:
                    predicted = float(model.predict(feature_row)[0])
                except Exception as exc:
                    LOGGER.warning("Model prediction failed for %s: %s", device_id, exc)
        residual = actual - predicted

        threshold_cfg = thresholds_by_device.get(device_id, thresholds_default)
        threshold = threshold_cfg.k * threshold_cfg.sigma_residuals

        consecutive = consecutive_counts.get(device_id, 0)
        triggered = residual > threshold
        if triggered:
            consecutive += 1
        else:
            consecutive = 0
        consecutive_counts[device_id] = consecutive

        alert_triggered = triggered and consecutive >= sustained_window
        prediction_rows.append(
            {
                "timestamp": row["timestamp"],
                "device_id": device_id,
                "actual_wattage": actual,
                "predicted_wattage": predicted,
                "residual_wattage": residual,
                "alert_triggered": alert_triggered,
                "created_at": now,
            }
        )

        if alert_triggered:
            alert_payloads.append(
                _build_contract_c_payload(
                    user_account_id=user_account_id,
                    device_id=device_id,
                    timestamp=row["timestamp"],
                    actual=actual,
                    predicted=predicted,
                    threshold=threshold,
                )
            )

    LOGGER.info("Writing predictions log and advancing cursor...")
    new_cursor = int(readings["id"].max())
    state_payload = [
        {"key": WORKER_STATE_CURSOR_KEY, "value": str(new_cursor)},
    ]
    state_payload.extend(
        {"key": f"consecutive_{device_id}", "value": str(value)}
        for device_id, value in consecutive_counts.items()
    )
    with engine.begin() as conn:
        insert_predictions(conn, prediction_rows)
        upsert_worker_state(conn, state_payload)

    pushed = 0
    push_failures = 0
    for payload in alert_payloads:
        try:
            push_anomaly_alert(payload)
            pushed += 1
        except DjangoAlertPushError as exc:
            push_failures += 1
            LOGGER.error("Contract C push failed: %s", exc)

    LOGGER.info(
        "Processed %s rows (predictor=%s), alerts_triggered=%s, pushed=%s, push_failures=%s, cursor=%s",
        len(prediction_rows),
        predictor_mode,
        len(alert_payloads),
        pushed,
        push_failures,
        new_cursor,
    )

    return {
        "processed": len(prediction_rows),
        "alerts_triggered": len(alert_payloads),
        "pushed": pushed,
        "push_failures": push_failures,
        "cursor": new_cursor,
        "skipped_no_readings": False,
        "model_loaded": model_loaded,
        "predictor_mode": predictor_mode,
    }


def main() -> None:
    args = build_arg_parser().parse_args()
    setup_logging(args.log_level)
    try:
        run_one_pass(args.config)
    except RuntimeError as exc:
        LOGGER.error("%s", exc)
        sys.exit(2)


if __name__ == "__main__":
    main()

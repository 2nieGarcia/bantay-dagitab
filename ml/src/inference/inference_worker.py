from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import pandas as pd
import yaml
import os
import requests
from sqlalchemy import bindparam, text

from src.db import get_engine


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOGGER = logging.getLogger("inference_worker")


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


def fetch_unprocessed(engine, cutoff: datetime, limit: int) -> pd.DataFrame:
    query = text(
        """
        SELECT id, device_id, user_account_id, timestamp, avg_wattage
        FROM iot_readings
        WHERE processed = FALSE
          AND timestamp >= :cutoff
        ORDER BY timestamp ASC
        LIMIT :limit
        """
    )
    return pd.read_sql_query(
        query,
        engine,
        params={"cutoff": cutoff, "limit": limit},
    )


def fetch_device_means(engine, device_ids: Iterable[str]) -> Dict[str, float]:
    if not device_ids:
        return {}
    query = text(
        """
        SELECT device_id, AVG(avg_wattage) AS mean_wattage
        FROM iot_readings
        WHERE device_id IN :device_ids
        GROUP BY device_id
        """
    ).bindparams(bindparam("device_ids", expanding=True))
    df = pd.read_sql_query(query, engine, params={"device_ids": list(device_ids)})
    return {row["device_id"]: float(row["mean_wattage"]) for _, row in df.iterrows()}


def load_consecutive_counts(engine, device_ids: Iterable[str]) -> Dict[str, int]:
    if not device_ids:
        return {}
    keys = [f"consecutive_{device_id}" for device_id in device_ids]
    query = text(
        """
        SELECT key, value
        FROM worker_state
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


def upsert_consecutive_counts(conn, counts: Dict[str, int]) -> None:
    if not counts:
        return
    payload = [
        {"key": f"consecutive_{device_id}", "value": str(value)}
        for device_id, value in counts.items()
    ]
    query = text(
        """
        INSERT INTO worker_state (key, value)
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
        INSERT INTO predictions_log (
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


def insert_alerts(conn, rows: List[Dict]) -> None:
    if not rows:
        return
    query = text(
        """
        INSERT INTO anomaly_alerts (
            alert_id,
            device_id,
            user_account_id,
            alert_timestamp,
            alert_type,
            actual_wattage,
            predicted_wattage,
            residual_wattage,
            threshold_wattage,
            k_value,
            sigma_residuals,
            consecutive_count,
            created_at
        ) VALUES (
            :alert_id,
            :device_id,
            :user_account_id,
            :alert_timestamp,
            :alert_type,
            :actual_wattage,
            :predicted_wattage,
            :residual_wattage,
            :threshold_wattage,
            :k_value,
            :sigma_residuals,
            :consecutive_count,
            :created_at
        )
        """
    )
    conn.execute(query, rows)

def send_alerts_to_django(rows: List[Dict]) -> None:
    if not rows:
        return
    backend_url = os.environ.get("BACKEND_API_URL", "http://backend:8000")
    endpoint = f"{backend_url.rstrip('/')}/api/analytics/ingest/"
    token = os.environ.get("SERVICE_ACCOUNT_TOKEN", "")
    headers = {"X-Service-Token": token, "Content-Type": "application/json"}
    
    for row in rows:
        expected_min = max(0, row["predicted_wattage"] - row["threshold_wattage"])
        expected_max = row["predicted_wattage"] + row["threshold_wattage"]
        payload = {
            "alert_id": str(row["alert_id"]),
            "device_id": str(row["device_id"]),
            "user_account_id": str(row["user_account_id"]),
            "timestamp": row["alert_timestamp"].isoformat(),
            "alert_type": "HIGH_USAGE_ANOMALY",
            "expected_wattage_range": f"{expected_min:.1f}-{expected_max:.1f}",
            "actual_wattage": row["actual_wattage"],
            "message": f"Sustained over-consumption detected for {row['consecutive_count']} consecutive intervals."
        }
        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=10)
            resp.raise_for_status()
            LOGGER.info(f"Successfully posted alert {row['alert_id']} to Django backend")
        except Exception as e:
            LOGGER.error(f"Failed to post alert {row['alert_id']} to backend: {e}")

def mark_processed(conn, ids: Iterable[int]) -> None:
    ids = list(ids)
    if not ids:
        return
    query = text(
        """
        UPDATE iot_readings
        SET processed = TRUE
        WHERE id IN :ids
        """
    ).bindparams(bindparam("ids", expanding=True))
    conn.execute(query, {"ids": ids})


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


def main() -> None:
    args = build_arg_parser().parse_args()
    setup_logging(args.log_level)

    config = load_config(args.config)
    deployment_cfg = config.get("deployment", {})
    inference_cfg = config.get("inference", {})
    anomaly_cfg = config.get("anomaly", {})
    thresholds_default, thresholds_by_device = load_thresholds(anomaly_cfg)

    lookback_minutes = int(inference_cfg.get("lookback_minutes", 10))
    batch_size = int(inference_cfg.get("batch_size", 1000))
    sustained_window = int(anomaly_cfg.get("sustained_window", 3))

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
    engine = get_engine()

    LOGGER.info("Loading new readings...")
    readings = fetch_unprocessed(engine, cutoff, batch_size)
    if readings.empty:
        LOGGER.info("No new readings found.")
        return

    device_ids = sorted(readings["device_id"].unique())
    device_means = fetch_device_means(engine, device_ids)
    consecutive_counts = load_consecutive_counts(engine, device_ids)

    prediction_rows: List[Dict] = []
    alert_rows: List[Dict] = []
    now = datetime.now(timezone.utc)

    for _, row in readings.iterrows():
        device_id = row["device_id"]
        user_account_id = row["user_account_id"]
        actual = float(row["avg_wattage"])
        predicted = device_means.get(device_id, actual)
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
            alert_rows.append(
                {
                    "alert_id": f"{device_id}-{row['timestamp'].isoformat()}",
                    "device_id": device_id,
                    "user_account_id": user_account_id,
                    "alert_timestamp": row["timestamp"],
                    "alert_type": "SUSTAINED_OVER_CONSUMPTION",
                    "actual_wattage": actual,
                    "predicted_wattage": predicted,
                    "residual_wattage": residual,
                    "threshold_wattage": threshold,
                    "k_value": threshold_cfg.k,
                    "sigma_residuals": threshold_cfg.sigma_residuals,
                    "consecutive_count": consecutive,
                    "created_at": now,
                }
            )

    LOGGER.info("Writing predictions and alerts...")
    with engine.begin() as conn:
        insert_predictions(conn, prediction_rows)
        insert_alerts(conn, alert_rows)
        mark_processed(conn, readings["id"].tolist())
        upsert_consecutive_counts(conn, consecutive_counts)
    
    send_alerts_to_django(alert_rows)

    LOGGER.info(
        "Processed %s rows, alerts=%s",
        len(prediction_rows),
        len(alert_rows),
    )


if __name__ == "__main__":
    main()

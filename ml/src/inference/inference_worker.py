from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import joblib
import numpy as np
import pandas as pd
import yaml
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
        FROM iot_readings
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
    history_df: pd.DataFrame,
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

    # Fill any remaining NaN values with 0 as last resort
    row_features = last_row[feature_cols].fillna(0)

    return row_features


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
    history_days = int(inference_cfg.get("history_days", 7))

    model_payload = None
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

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
    engine = get_engine()

    LOGGER.info("Loading new readings...")
    readings = fetch_unprocessed(engine, cutoff, batch_size)
    if readings.empty:
        LOGGER.info("No new readings found.")
        return

    device_ids = sorted(readings["device_id"].unique())
    device_means = fetch_device_means(engine, device_ids)
    history_cutoff = datetime.now(timezone.utc) - timedelta(days=history_days)
    history_by_device = fetch_recent_history(engine, device_ids, history_cutoff)
    consecutive_counts = load_consecutive_counts(engine, device_ids)

    prediction_rows: List[Dict] = []
    alert_rows: List[Dict] = []
    now = datetime.now(timezone.utc)

    for _, row in readings.iterrows():
        device_id = row["device_id"]
        user_account_id = row["user_account_id"]
        actual = float(row["avg_wattage"])
        predicted = device_means.get(device_id, actual)
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

    LOGGER.info(
        "Processed %s rows, alerts=%s",
        len(prediction_rows),
        len(alert_rows),
    )


if __name__ == "__main__":
    main()
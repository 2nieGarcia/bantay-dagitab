# src/monitoring/daily_report.py
"""
Daily Monitoring Report — Baseline Implementation

Scheduled script (cron daily at midnight) that:
1. Queries the predictions_log table from the deployment database
2. Computes operational and model performance metrics per device
3. Detects residual distribution drift via Kolmogorov-Smirnov test
4. Generates a health status (green/yellow/red) per device
5. Writes daily_report_YYYY-MM-DD.json to output/monitoring/
6. Optionally sends email alerts for red-status devices

Usage:
    python -m src.monitoring.daily_report
    python -m src.monitoring.daily_report --date 2024-03-15 --config config/monitoring.yaml
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import smtplib
import sys
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yaml
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from src.db import get_engine
try:
    from scipy import stats as scipy_stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


# ============================================================================
# Paths & Constants
# ============================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "monitoring.yaml"
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "deployment.db"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output" / "monitoring"

# Health status levels
STATUS_GREEN = "green"
STATUS_YELLOW = "yellow"
STATUS_RED = "red"

logger = logging.getLogger("monitoring")


def setup_logging(level: str = "INFO") -> None:
    """Configure logging for the monitoring script."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    logger.addHandler(handler)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))


# ============================================================================
# Database Layer
# ============================================================================

def get_db_engine(db_url: Optional[str] = None) -> Engine:
    """Create a database engine for monitoring queries."""
    return get_engine(db_url)


# ============================================================================
# Data Loading
# ============================================================================

def load_predictions_log(
    conn: Connection,
    start_date: datetime,
    end_date: datetime,
) -> pd.DataFrame:
    """
    Load predictions log entries for a given time window.

    Args:
        conn: Read-only database connection.
        start_date: Start of window (inclusive).
        end_date: End of window (exclusive).

    Returns:
        DataFrame with columns from predictions_log table, timestamp as datetime.
    """
    query = text(
        """
        SELECT *
        FROM predictions_log
        WHERE timestamp >= :start_date AND timestamp < :end_date
        ORDER BY timestamp ASC
        """
    )
    params = {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()}

    df = pd.read_sql_query(query, conn, params=params)
    if not df.empty:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


def load_alerts_log(
    conn: Connection,
    start_date: datetime,
    end_date: datetime,
) -> pd.DataFrame:
    """
    Load anomaly alerts for a given time window.

    Args:
        conn: Read-only database connection.
        start_date: Start of window (inclusive).
        end_date: End of window (exclusive).

    Returns:
        DataFrame with columns from anomaly_alerts table.
    """
    query = text(
        """
        SELECT *
        FROM anomaly_alerts
        WHERE alert_timestamp >= :start_date AND alert_timestamp < :end_date
        ORDER BY alert_timestamp ASC
        """
    )
    params = {"start_date": start_date.isoformat(), "end_date": end_date.isoformat()}

    df = pd.read_sql_query(query, conn, params=params)
    if not df.empty:
        df["alert_timestamp"] = pd.to_datetime(df["alert_timestamp"], utc=True)
    return df


def load_validation_residuals(
    validation_path: Path,
) -> Optional[pd.DataFrame]:
    """
    Load validation set residuals from the evaluation stage output.

    Expected format: CSV or Parquet with columns:
        device_id, residual_wattage (or residual_mean, residual_std)

    Falls back gracefully if the file doesn't exist.
    """
    if not validation_path.exists():
        logger.warning(f"Validation residuals file not found: {validation_path}")
        return None

    if validation_path.suffix == ".csv":
        return pd.read_csv(validation_path)
    elif validation_path.suffix == ".parquet":
        return pd.read_parquet(validation_path)
    else:
        logger.warning(f"Unsupported validation residuals format: {validation_path.suffix}")
        return None


# ============================================================================
# Metric Computation
# ============================================================================

def compute_operational_metrics(
    predictions_df: pd.DataFrame,
    alerts_df: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Compute operational metrics from the predictions log.

    Args:
        predictions_df: Predictions log data for the window.
        alerts_df: Alerts data for the window.

    Returns:
        Dict with operational metrics.
    """
    total_readings = len(predictions_df)

    if total_readings == 0:
        return {
            "total_readings": 0,
            "error_count": 0,
            "error_rate": 0.0,
            "alerts_generated": 0,
            "throughput_readings_per_hour": 0.0,
        }

    # Error rate: NaN predictions or zero-division cases
    error_mask = (
        predictions_df["predicted_wattage"].isna()
        | np.isinf(predictions_df["predicted_wattage"])
    )
    error_count = int(error_mask.sum())
    error_rate = error_count / total_readings if total_readings > 0 else 0.0

    # Throughput: readings per hour over the window
    if not predictions_df.empty:
        time_span_hours = (
            predictions_df["timestamp"].max() - predictions_df["timestamp"].min()
        ).total_seconds() / 3600.0
        time_span_hours = max(time_span_hours, 1.0)  # minimum 1 hour
        throughput = total_readings / time_span_hours
    else:
        throughput = 0.0

    return {
        "total_readings": total_readings,
        "error_count": error_count,
        "error_rate": round(error_rate, 6),
        "alerts_generated": len(alerts_df),
        "throughput_readings_per_hour": round(throughput, 2),
    }


def compute_model_performance_metrics(
    predictions_df: pd.DataFrame,
    alerts_df: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Compute model performance metrics from the predictions log.

    Args:
        predictions_df: Predictions log data.
        alerts_df: Alerts data.

    Returns:
        Dict with model performance metrics.
    """
    total_readings = len(predictions_df)

    if total_readings == 0:
        return {
            "mae_watts": None,
            "rmse_watts": None,
            "alert_rate": 0.0,
            "residual_mean": None,
            "residual_std": None,
            "residual_p95": None,
        }

    # Filter to valid predictions
    valid = predictions_df.dropna(subset=["actual_wattage", "predicted_wattage"]).copy()
    if valid.empty:
        return {
            "mae_watts": None,
            "rmse_watts": None,
            "alert_rate": 0.0,
            "residual_mean": None,
            "residual_std": None,
            "residual_p95": None,
        }

    actual = valid["actual_wattage"].to_numpy(dtype=float)
    predicted = valid["predicted_wattage"].to_numpy(dtype=float)
    residuals = actual - predicted

    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    residual_mean = float(np.mean(residuals))
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0
    residual_p95 = float(np.percentile(np.abs(residuals), 95))

    # Alert rate: fraction of readings that triggered an alert
    if "alert_triggered" in predictions_df.columns:
        alert_rate = float(predictions_df["alert_triggered"].mean())
    else:
        alert_rate = len(alerts_df) / total_readings if total_readings > 0 else 0.0

    return {
        "mae_watts": round(mae, 2),
        "rmse_watts": round(rmse, 2),
        "alert_rate": round(alert_rate, 6),
        "residual_mean": round(residual_mean, 2),
        "residual_std": round(residual_std, 2),
        "residual_p95": round(residual_p95, 2),
    }


def compute_drift_metrics(
    predictions_df: pd.DataFrame,
    validation_residuals_df: Optional[pd.DataFrame],
    device_id: str,
) -> Dict[str, Any]:
    """
    Compute distribution drift metrics using Kolmogorov-Smirnov test.

    Compares the residual distribution from the monitoring window
    against the validation period residuals (if available).

    Args:
        predictions_df: Predictions log data for the monitoring window.
        validation_residuals_df: Validation period residuals (from evaluation).
        device_id: Device identifier for filtering validation data.

    Returns:
        Dict with drift metrics.
    """
    result = {
        "ks_statistic": None,
        "ks_pvalue": None,
        "drift_detected": False,
        "validation_residuals_available": False,
    }

    # Get current window residuals
    valid = predictions_df.dropna(subset=["actual_wattage", "predicted_wattage"])
    if valid.empty:
        return result

    current_residuals = (
        valid["actual_wattage"].to_numpy(dtype=float)
        - valid["predicted_wattage"].to_numpy(dtype=float)
    )

    if len(current_residuals) < 30:
        logger.debug(f"Insufficient data for drift test on {device_id}: {len(current_residuals)} points")
        return result

    # If validation residuals available, run KS test
    if validation_residuals_df is not None and not validation_residuals_df.empty:
        result["validation_residuals_available"] = True

        # Filter validation residuals for this device if column exists
        if "device_id" in validation_residuals_df.columns:
            val_device = validation_residuals_df[
                validation_residuals_df["device_id"] == device_id
            ]
        else:
            val_device = validation_residuals_df

        # Extract residual column
        if "residual_wattage" in val_device.columns:
            val_residuals = val_device["residual_wattage"].dropna().to_numpy(dtype=float)
        elif "residual_mean" in val_device.columns and "residual_std" in val_device.columns:
            # Synthetic: reconstruct approximate distribution from summary stats
            r_mean = val_device["residual_mean"].iloc[0]
            r_std = val_device["residual_std"].iloc[0]
            rng = np.random.default_rng(42)
            val_residuals = rng.normal(r_mean, max(r_std, 1.0), size=500)
        else:
            logger.warning(f"No residual column found in validation data for {device_id}")
            return result

        if len(val_residuals) >= 30 and SCIPY_AVAILABLE:
            ks_stat, ks_pval = scipy_stats.ks_2samp(current_residuals, val_residuals)
            result["ks_statistic"] = round(float(ks_stat), 4)
            result["ks_pvalue"] = round(float(ks_pval), 4)
        elif not SCIPY_AVAILABLE:
            logger.warning("scipy not available — skipping KS test")

    return result


# ============================================================================
# Health Status Determination
# ============================================================================

def determine_health_status(
    operational: Dict[str, Any],
    performance: Dict[str, Any],
    drift: Dict[str, Any],
    thresholds: Any,
    previous_alert_rates: Optional[List[float]] = None,
) -> Tuple[str, List[str]]:
    """
    Determine overall health status and collect warning reasons.

    Status logic:
        GREEN  — All metrics within normal bounds.
        YELLOW — One or more metrics at warning level (immediate attention not required).
        RED    — One or more metrics at critical level (immediate attention required).

    Args:
        operational: Operational metrics dict.
        performance: Model performance metrics dict.
        drift: Drift metrics dict.
        thresholds: MonitoringThresholds instance.
        previous_alert_rates: Alert rates from the 2 previous days for sustained check.

    Returns:
        Tuple of (status_string, list_of_warning_reasons).
    """
    reasons = []
    status = STATUS_GREEN

    # --- Operational checks ---
    if operational["error_rate"] > thresholds.error_rate_fraction:
        reasons.append(
            f"Error rate {operational['error_rate']:.4f} exceeds threshold "
            f"{thresholds.error_rate_fraction}"
        )
        status = max_status(status, STATUS_RED)

    if operational["total_readings"] < thresholds.min_readings_per_device_per_day:
        reasons.append(
            f"Low reading volume: {operational['total_readings']} readings "
            f"(threshold: {thresholds.min_readings_per_device_per_day})"
        )
        status = max_status(status, STATUS_YELLOW)

    # --- Model performance checks ---
    if performance["alert_rate"] is not None:
        alert_rate = performance["alert_rate"]

        # Immediate: 24h alert rate > 15%
        if alert_rate > thresholds.alert_rate_fraction_24h:
            reasons.append(
                f"High 24h alert rate: {alert_rate:.4f} "
                f"(threshold: {thresholds.alert_rate_fraction_24h})"
            )
            status = max_status(status, STATUS_RED)

        # Sustained: 3-day average alert rate > 10%
        if previous_alert_rates and len(previous_alert_rates) >= 2:
            sustained_rate = np.mean(previous_alert_rates + [alert_rate])
            if sustained_rate > thresholds.alert_rate_fraction_3day:
                reasons.append(
                    f"Sustained high alert rate (3-day avg): {sustained_rate:.4f} "
                    f"(threshold: {thresholds.alert_rate_fraction_3day})"
                )
                status = max_status(status, STATUS_RED)

    # --- Drift checks ---
    if drift.get("ks_pvalue") is not None:
        if drift["ks_pvalue"] < thresholds.ks_pvalue_threshold:
            reasons.append(
                f"Residual distribution drift detected: "
                f"KS p-value = {drift['ks_pvalue']:.4f} "
                f"(threshold: {thresholds.ks_pvalue_threshold})"
            )
            status = max_status(status, STATUS_YELLOW)

    # --- Data quality checks ---
    if operational["total_readings"] == 0:
        reasons.append("No readings received in monitoring window")
        status = max_status(status, STATUS_RED)

    return status, reasons


def max_status(current: str, new: str) -> str:
    """Return the more severe of two status levels."""
    order = {STATUS_GREEN: 0, STATUS_YELLOW: 1, STATUS_RED: 2}
    return new if order.get(new, 0) > order.get(current, 0) else current


# ============================================================================
# Per-Device Report
# ============================================================================

def generate_device_report(
    device_id: str,
    predictions_df: pd.DataFrame,
    alerts_df: pd.DataFrame,
    validation_residuals_df: Optional[pd.DataFrame],
    thresholds: Any,
    previous_alert_rates: Optional[Dict[str, List[float]]] = None,
) -> Dict[str, Any]:
    """
    Generate a complete monitoring report for a single device.

    Args:
        device_id: Device identifier.
        predictions_df: Predictions log filtered to this device and window.
        alerts_df: Alerts filtered to this device and window.
        validation_residuals_df: Validation period residuals.
        thresholds: MonitoringThresholds instance.
        previous_alert_rates: Dict of device_id -> list of previous 2 days' alert rates.

    Returns:
        Dict with all metrics and health status for the device.
    """
    operational = compute_operational_metrics(predictions_df, alerts_df)
    performance = compute_model_performance_metrics(predictions_df, alerts_df)
    drift = compute_drift_metrics(predictions_df, validation_residuals_df, device_id)

    prev_rates = previous_alert_rates.get(device_id) if previous_alert_rates else None
    health_status, warnings = determine_health_status(
        operational, performance, drift, thresholds, prev_rates
    )

    return {
        "device_id": device_id,
        "health_status": health_status,
        "warnings": warnings,
        "operational": operational,
        "performance": performance,
        "drift": drift,
    }


# ============================================================================
# Email Alerts
# ============================================================================

def send_email_alert(
    config: Dict[str, Any],
    report_date: str,
    red_devices: List[str],
    yellow_devices: List[str],
) -> bool:
    """
    Send email notification for devices with warning/critical status.

    Args:
        config: Monitoring configuration dict.
        report_date: Date string of the report.
        red_devices: List of device IDs with RED status.
        yellow_devices: List of device IDs with YELLOW status.

    Returns:
        True if email sent successfully, False otherwise.
    """
    email_config = config.get("email_alerts_enabled", False)
    if not email_config:
        logger.info("Email alerts disabled. Skipping notification.")
        return False

    sender = config.get("email_sender", "")
    recipients = config.get("email_recipients", [])
    password_env_var = config.get("email_password_env_var", "")

    if not sender or not recipients:
        logger.warning("Email sender or recipients not configured. Skipping.")
        return False

    password = os.environ.get(password_env_var, "")
    if not password:
        logger.warning(f"Email password not found in env var: {password_env_var}")
        return False

    # Build email
    subject = f"[Bantay-Dagitab] Monitoring Alert — {report_date}"
    body = f"""
    Daily Monitoring Report — {report_date}

    Devices requiring attention:

    CRITICAL (RED) — {len(red_devices)} devices:
    {chr(10).join(f'  - {d}' for d in red_devices) if red_devices else '  None'}

    WARNING (YELLOW) — {len(yellow_devices)} devices:
    {chr(10).join(f'  - {d}' for d in yellow_devices) if yellow_devices else '  None'}

    Full report: output/monitoring/daily_report_{report_date}.json

    This is an automated message from the Bantay-Dagitab monitoring system.
    """

    msg = MIMEMultipart()
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        smtp_host = config.get("email_smtp_host", "smtp.gmail.com")
        smtp_port = config.get("email_smtp_port", 587)

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(sender, password)
            server.sendmail(sender, recipients, msg.as_string())

        logger.info(f"Alert email sent to {len(recipients)} recipients")
        return True

    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")
        return False


# ============================================================================
# Main Monitoring Routine
# ============================================================================

def run_daily_monitoring(
    config: Dict[str, Any],
    report_date: Optional[str] = None,
    db_path: Optional[Path] = None,
    output_dir: Optional[Path] = None,
    validation_residuals_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Execute the daily monitoring routine.

    1. Load predictions log for 24h and 7-day windows
    2. Compute metrics per active device
    3. Detect drift against validation residuals
    4. Determine health status
    5. Write JSON report
    6. Optionally send email alerts

    Args:
        config: Parsed monitoring configuration.
        report_date: Date to generate report for (default: today in UTC).
        db_path: Path to deployment database.
        output_dir: Directory for report output.
        validation_residuals_path: Path to validation residuals from evaluation.

    Returns:
        Full monitoring report as a dict.
    """
    # Parse configuration
    thresholds_data = config.get("thresholds", {})
    from src.monitoring.config import MonitoringThresholds
    thresholds = MonitoringThresholds(**thresholds_data)

    # Resolve paths
    db_url = config.get("database", {}).get("url")
    if db_path is not None:
        db_url = str(db_path)

    if output_dir is None:
        output_dir = DEFAULT_OUTPUT_DIR
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine report date
    if report_date is None:
        report_end = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    else:
        report_end = datetime.fromisoformat(report_date).replace(tzinfo=timezone.utc)
        report_end = report_end + timedelta(days=1)  # end of the report date

    report_start_24h = report_end - timedelta(days=1)
    report_start_7d = report_end - timedelta(days=7)
    report_date_str = (report_end - timedelta(days=1)).strftime("%Y-%m-%d")

    logger.info("=" * 60)
    logger.info(f"Daily Monitoring Report — {report_date_str}")
    logger.info("=" * 60)

    # Connect to database
    engine = get_db_engine(db_url)

    # Load data windows
    logger.info("Loading predictions log...")
    with engine.connect() as conn:
        predictions_24h = load_predictions_log(conn, report_start_24h, report_end)
        predictions_7d = load_predictions_log(conn, report_start_7d, report_end)
        alerts_24h = load_alerts_log(conn, report_start_24h, report_end)

        # Load historical alert rates for sustained check (previous 2 days)
        prev_3d_start = report_end - timedelta(days=4)
        predictions_4d = load_predictions_log(conn, prev_3d_start, report_end)
        previous_alert_rates: Dict[str, List[float]] = {}

        if not predictions_4d.empty:
            predictions_4d["date"] = predictions_4d["timestamp"].dt.date
            for device_id, device_df in predictions_4d.groupby("device_id"):
                daily_rates = []
                for date_val in sorted(device_df["date"].unique()):
                    day_df = device_df[device_df["date"] == date_val]
                    if "alert_triggered" in day_df.columns:
                        daily_rates.append(float(day_df["alert_triggered"].mean()))
                # Keep only the 2 days before the report date
                previous_alert_rates[device_id] = (
                    daily_rates[-3:-1] if len(daily_rates) >= 3 else daily_rates
                )

    # Load validation residuals for drift detection
    if validation_residuals_path is None:
        validation_residuals_path = PROJECT_ROOT / "output" / "reports" / "validation_residuals.parquet"
    validation_residuals_df = load_validation_residuals(validation_residuals_path)

    logger.info(
        f"24h window: {len(predictions_24h)} readings, "
        f"{len(alerts_24h)} alerts"
    )
    logger.info(
        f"7d window: {len(predictions_7d)} readings"
    )

    # Identify active devices
    if predictions_7d.empty:
        active_devices = []
    else:
        active_devices = sorted(predictions_7d["device_id"].unique())

    if not active_devices:
        logger.warning("No active devices found. Generating empty report.")

    # Generate per-device reports
    device_reports = []
    red_devices = []
    yellow_devices = []

    for device_id in active_devices:
        dev_24h = predictions_24h[predictions_24h["device_id"] == device_id]
        dev_alerts_24h = alerts_24h[alerts_24h["device_id"] == device_id]

        report = generate_device_report(
            device_id=device_id,
            predictions_df=dev_24h,
            alerts_df=dev_alerts_24h,
            validation_residuals_df=validation_residuals_df,
            thresholds=thresholds,
            previous_alert_rates=previous_alert_rates,
        )
        device_reports.append(report)

        if report["health_status"] == STATUS_RED:
            red_devices.append(device_id)
        elif report["health_status"] == STATUS_YELLOW:
            yellow_devices.append(device_id)

        # Log status
        status_emoji = {"green": "✓", "yellow": "⚠", "red": "✗"}
        emoji = status_emoji.get(report["health_status"], "?")
        logger.info(
            f"  {emoji} {device_id}: {report['health_status'].upper()} "
            f"({len(report['warnings'])} warnings)"
        )
        for warning in report["warnings"]:
            logger.info(f"      → {warning}")

    # Compute summary statistics
    summary = _compute_summary(device_reports, predictions_24h, predictions_7d, alerts_24h)

    # Assemble full report
    full_report = {
        "report_date": report_date_str,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "devices": device_reports,
        "thresholds": thresholds_data,
    }

    # Write JSON report
    report_path = output_dir / f"daily_report_{report_date_str}.json"
    report_path.write_text(json.dumps(full_report, indent=2, default=str))
    logger.info(f"\nReport written to: {report_path}")

    # Also write a latest symlink/copy for dashboard consumption
    latest_path = output_dir / "latest_report.json"
    latest_path.write_text(json.dumps(full_report, indent=2, default=str))
    logger.info(f"Latest report: {latest_path}")

    # Send email if needed
    if red_devices or yellow_devices:
        send_email_alert(config, report_date_str, red_devices, yellow_devices)

    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info(f"Monitoring complete.")
    logger.info(f"  Total devices: {summary['total_devices']}")
    logger.info(f"  Green:  {summary['devices_green']}")
    logger.info(f"  Yellow: {summary['devices_yellow']}")
    logger.info(f"  Red:    {summary['devices_red']}")
    logger.info("=" * 60)

    return full_report


def _compute_summary(
    device_reports: List[Dict[str, Any]],
    predictions_24h: pd.DataFrame,
    predictions_7d: pd.DataFrame,
    alerts_24h: pd.DataFrame,
) -> Dict[str, Any]:
    """Compute summary statistics across all devices."""
    total_devices = len(device_reports)
    devices_green = sum(1 for d in device_reports if d["health_status"] == STATUS_GREEN)
    devices_yellow = sum(1 for d in device_reports if d["health_status"] == STATUS_YELLOW)
    devices_red = sum(1 for d in device_reports if d["health_status"] == STATUS_RED)

    # Aggregate metrics
    mae_values = [
        d["performance"]["mae_watts"] for d in device_reports
        if d["performance"]["mae_watts"] is not None
    ]
    alert_rates = [
        d["performance"]["alert_rate"] for d in device_reports
        if d["performance"]["alert_rate"] is not None
    ]

    return {
        "total_devices": total_devices,
        "devices_green": devices_green,
        "devices_yellow": devices_yellow,
        "devices_red": devices_red,
        "total_readings_24h": len(predictions_24h),
        "total_readings_7d": len(predictions_7d),
        "total_alerts_24h": len(alerts_24h),
        "avg_mae_watts": round(float(np.mean(mae_values)), 2) if mae_values else None,
        "avg_alert_rate": round(float(np.mean(alert_rates)), 6) if alert_rates else None,
        "drift_devices_count": sum(
            1 for d in device_reports
            if d["drift"].get("drift_detected", False)
        ),
    }


# ============================================================================
# CLI
# ============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    """Build CLI argument parser for the monitoring script."""
    parser = argparse.ArgumentParser(
        description="Daily monitoring report — checks model health and detects drift"
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Report date in YYYY-MM-DD format (default: today UTC)",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to monitoring.yaml configuration file",
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=None,
        help="Database URL override (overrides config)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory for monitoring reports (overrides default)",
    )
    parser.add_argument(
        "--validation-residuals",
        type=str,
        default=None,
        help="Path to validation residuals file from evaluation stage",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging verbosity level",
    )
    return parser


def main() -> None:
    """CLI entry point — designed for daily cron execution."""
    parser = build_arg_parser()
    args = parser.parse_args()

    setup_logging(args.log_level)

    # Load configuration
    config_path = Path(args.config)
    if config_path.exists():
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
    else:
        logger.warning(f"Config file not found: {config_path}. Using defaults.")
        from src.monitoring.config import MonitoringConfig
        config = MonitoringConfig().__dict__

    # Resolve optional paths
    db_path = Path(args.db_path) if args.db_path else None
    output_dir = Path(args.output_dir) if args.output_dir else None
    validation_path = Path(args.validation_residuals) if args.validation_residuals else None

    try:
        run_daily_monitoring(
            config=config,
            report_date=args.date,
            db_path=db_path,
            output_dir=output_dir,
            validation_residuals_path=validation_path,
        )
    except Exception as e:
        logger.exception(f"Monitoring failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
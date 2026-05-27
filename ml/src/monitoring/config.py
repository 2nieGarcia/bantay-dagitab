# src/monitoring/config.py
"""
Monitoring configuration with sensible defaults.

All thresholds can be overridden via config/monitoring.yaml.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict


@dataclass
class MonitoringThresholds:
    """Thresholds that trigger warnings or alerts."""

    # Operational
    inference_latency_p95_seconds: float = 120.0  # 2 minutes for cron batch
    error_rate_fraction: float = 0.01  # 1%

    # Model performance
    mae_change_pct_24h: float = 50.0  # 50% increase vs 7-day baseline
    alert_rate_fraction_3day: float = 0.10  # 10% sustained over 3 days
    alert_rate_fraction_24h: float = 0.15  # 15% in 24h — immediate warning

    # Drift
    ks_pvalue_threshold: float = 0.05  # p < 0.05 indicates significant shift
    psi_threshold: float = 0.25  # PSI > 0.25 indicates significant drift

    # Data quality
    min_readings_per_device_per_day: int = 50  # expect ~96 per day


@dataclass
class MonitoringConfig:
    """Full monitoring configuration."""

    thresholds: MonitoringThresholds = field(default_factory=MonitoringThresholds)
    email_alerts_enabled: bool = False
    email_smtp_host: str = "smtp.gmail.com"
    email_smtp_port: int = 587
    email_sender: str = ""
    email_recipients: list = field(default_factory=list)
    email_password_env_var: str = "MONITORING_EMAIL_PASSWORD"
"""
Synthetic Data Generator — Baseline + Advanced
Residential Energy Anomaly Detection for Bill Shock Prevention

Generates raw IoT readings (Contract A) and OCR bill records (Contract B)
for baseline (5 households) and advanced (10 households) datasets over 90 days.

Usage:
    python scripts/generate_synthetic_data.py --dataset baseline
    python scripts/generate_synthetic_data.py --dataset advanced
    python scripts/generate_synthetic_data.py --dataset both

Author: Ken Ira Lacson, ML Lead
Institution: National University - Manila
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd


# ============================================================================
# Configuration
# ============================================================================

MASTER_SEED = 42
READING_INTERVAL_MINUTES = 15
SLOTS_PER_DAY = 96
RATE_PESOS_PER_KWH = 11.50

# ---------------------------------------------------------------------------
# Baseline household profiles (Section 3.4)
# ---------------------------------------------------------------------------
BASELINE_HOUSEHOLDS: List[Dict[str, Any]] = [
    {
        "user_account_id": "user_001", "device_id": "meter_manila_001",
        "base_load": 80.0, "noise_std": 30.0,
        "weekday_peaks": [
            {"center_slot": 24, "amplitude": 400.0, "width": 4.0},
            {"center_slot": 76, "amplitude": 600.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 32, "amplitude": 300.0, "width": 4.0},
            {"center_slot": 80, "amplitude": 500.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_002", "device_id": "meter_manila_002",
        "base_load": 120.0, "noise_std": 40.0,
        "weekday_peaks": [
            {"center_slot": 26, "amplitude": 500.0, "width": 3.0},
            {"center_slot": 48, "amplitude": 300.0, "width": 2.0},
            {"center_slot": 74, "amplitude": 800.0, "width": 4.0},
        ],
        "weekend_peaks": [
            {"center_slot": 36, "amplitude": 400.0, "width": 3.0},
            {"center_slot": 76, "amplitude": 700.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_003", "device_id": "meter_manila_003",
        "base_load": 150.0, "noise_std": 50.0,
        "weekday_peaks": [
            {"center_slot": 22, "amplitude": 700.0, "width": 3.0},
            {"center_slot": 46, "amplitude": 400.0, "width": 2.0},
            {"center_slot": 78, "amplitude": 1200.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 30, "amplitude": 600.0, "width": 4.0},
            {"center_slot": 56, "amplitude": 500.0, "width": 3.0},
            {"center_slot": 80, "amplitude": 1100.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_004", "device_id": "meter_manila_004",
        "base_load": 200.0, "noise_std": 60.0,
        "weekday_peaks": [
            {"center_slot": 20, "amplitude": 900.0, "width": 4.0},
            {"center_slot": 48, "amplitude": 500.0, "width": 3.0},
            {"center_slot": 72, "amplitude": 1500.0, "width": 6.0},
        ],
        "weekend_peaks": [
            {"center_slot": 28, "amplitude": 700.0, "width": 4.0},
            {"center_slot": 52, "amplitude": 600.0, "width": 3.0},
            {"center_slot": 76, "amplitude": 1400.0, "width": 6.0},
        ],
    },
    {
        "user_account_id": "user_005", "device_id": "meter_manila_005",
        "base_load": 250.0, "noise_std": 70.0,
        "weekday_peaks": [
            {"center_slot": 20, "amplitude": 1100.0, "width": 4.0},
            {"center_slot": 50, "amplitude": 600.0, "width": 3.0},
            {"center_slot": 74, "amplitude": 1800.0, "width": 6.0},
        ],
        "weekend_peaks": [
            {"center_slot": 28, "amplitude": 900.0, "width": 4.0},
            {"center_slot": 54, "amplitude": 700.0, "width": 3.0},
            {"center_slot": 78, "amplitude": 1700.0, "width": 6.0},
        ],
    },
]

# ---------------------------------------------------------------------------
# Advanced household profiles (Section 4.9) — 10 households, 3 groups
# ---------------------------------------------------------------------------
ADVANCED_HOUSEHOLDS: List[Dict[str, Any]] = [
    # Group: Low baseline (no AC)
    {
        "user_account_id": "user_101", "device_id": "meter_manila_101",
        "base_load": 80.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 30.0, "drift_rate": -10.0,
        "ac_threshold": 30.0, "ac_sensitivity": 0.0,  # no AC
        "weekday_peaks": [
            {"center_slot": 24, "amplitude": 350.0, "width": 4.0},
            {"center_slot": 76, "amplitude": 500.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 32, "amplitude": 280.0, "width": 4.0},
            {"center_slot": 80, "amplitude": 450.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_102", "device_id": "meter_manila_102",
        "base_load": 100.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 25.0, "drift_rate": 5.0,
        "ac_threshold": 30.0, "ac_sensitivity": 0.0,
        "weekday_peaks": [
            {"center_slot": 26, "amplitude": 400.0, "width": 3.0},
            {"center_slot": 48, "amplitude": 250.0, "width": 2.0},
            {"center_slot": 74, "amplitude": 650.0, "width": 4.0},
        ],
        "weekend_peaks": [
            {"center_slot": 36, "amplitude": 320.0, "width": 3.0},
            {"center_slot": 76, "amplitude": 550.0, "width": 5.0},
        ],
    },
    # Group: Medium baseline (moderate AC)
    {
        "user_account_id": "user_103", "device_id": "meter_manila_103",
        "base_load": 140.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 50.0, "drift_rate": 15.0,
        "ac_threshold": 28.0, "ac_sensitivity": 80.0,
        "weekday_peaks": [
            {"center_slot": 22, "amplitude": 600.0, "width": 3.0},
            {"center_slot": 46, "amplitude": 350.0, "width": 2.0},
            {"center_slot": 78, "amplitude": 1000.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 30, "amplitude": 500.0, "width": 4.0},
            {"center_slot": 56, "amplitude": 400.0, "width": 3.0},
            {"center_slot": 80, "amplitude": 900.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_104", "device_id": "meter_manila_104",
        "base_load": 160.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 45.0, "drift_rate": -20.0,
        "ac_threshold": 27.0, "ac_sensitivity": 100.0,
        "weekday_peaks": [
            {"center_slot": 24, "amplitude": 650.0, "width": 3.0},
            {"center_slot": 48, "amplitude": 380.0, "width": 2.0},
            {"center_slot": 76, "amplitude": 1100.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 32, "amplitude": 520.0, "width": 4.0},
            {"center_slot": 54, "amplitude": 430.0, "width": 3.0},
            {"center_slot": 78, "amplitude": 1000.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_105", "device_id": "meter_manila_105",
        "base_load": 180.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 55.0, "drift_rate": 10.0,
        "ac_threshold": 26.0, "ac_sensitivity": 120.0,
        "weekday_peaks": [
            {"center_slot": 20, "amplitude": 750.0, "width": 4.0},
            {"center_slot": 50, "amplitude": 400.0, "width": 3.0},
            {"center_slot": 74, "amplitude": 1300.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 28, "amplitude": 600.0, "width": 4.0},
            {"center_slot": 52, "amplitude": 480.0, "width": 3.0},
            {"center_slot": 76, "amplitude": 1150.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_106", "device_id": "meter_manila_106",
        "base_load": 190.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 40.0, "drift_rate": -5.0,
        "ac_threshold": 28.0, "ac_sensitivity": 90.0,
        "weekday_peaks": [
            {"center_slot": 22, "amplitude": 700.0, "width": 3.0},
            {"center_slot": 46, "amplitude": 360.0, "width": 2.0},
            {"center_slot": 78, "amplitude": 1150.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 30, "amplitude": 550.0, "width": 4.0},
            {"center_slot": 56, "amplitude": 420.0, "width": 3.0},
            {"center_slot": 80, "amplitude": 1050.0, "width": 5.0},
        ],
    },
    {
        "user_account_id": "user_107", "device_id": "meter_manila_107",
        "base_load": 200.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 60.0, "drift_rate": 25.0,
        "ac_threshold": 27.0, "ac_sensitivity": 110.0,
        "weekday_peaks": [
            {"center_slot": 24, "amplitude": 720.0, "width": 3.0},
            {"center_slot": 48, "amplitude": 390.0, "width": 2.0},
            {"center_slot": 76, "amplitude": 1250.0, "width": 5.0},
        ],
        "weekend_peaks": [
            {"center_slot": 32, "amplitude": 580.0, "width": 4.0},
            {"center_slot": 54, "amplitude": 450.0, "width": 3.0},
            {"center_slot": 78, "amplitude": 1100.0, "width": 5.0},
        ],
    },
    # Group: High baseline (heavy AC)
    {
        "user_account_id": "user_108", "device_id": "meter_manila_108",
        "base_load": 240.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 70.0, "drift_rate": 30.0,
        "ac_threshold": 26.0, "ac_sensitivity": 160.0,
        "weekday_peaks": [
            {"center_slot": 20, "amplitude": 1000.0, "width": 4.0},
            {"center_slot": 48, "amplitude": 500.0, "width": 3.0},
            {"center_slot": 72, "amplitude": 1600.0, "width": 6.0},
        ],
        "weekend_peaks": [
            {"center_slot": 28, "amplitude": 800.0, "width": 4.0},
            {"center_slot": 52, "amplitude": 550.0, "width": 3.0},
            {"center_slot": 76, "amplitude": 1450.0, "width": 6.0},
        ],
    },
    {
        "user_account_id": "user_109", "device_id": "meter_manila_109",
        "base_load": 270.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 75.0, "drift_rate": -15.0,
        "ac_threshold": 25.0, "ac_sensitivity": 180.0,
        "weekday_peaks": [
            {"center_slot": 22, "amplitude": 1050.0, "width": 4.0},
            {"center_slot": 50, "amplitude": 520.0, "width": 3.0},
            {"center_slot": 74, "amplitude": 1700.0, "width": 6.0},
        ],
        "weekend_peaks": [
            {"center_slot": 30, "amplitude": 850.0, "width": 4.0},
            {"center_slot": 54, "amplitude": 580.0, "width": 3.0},
            {"center_slot": 78, "amplitude": 1550.0, "width": 6.0},
        ],
    },
    {
        "user_account_id": "user_110", "device_id": "meter_manila_110",
        "base_load": 300.0, "noise_std_base": 20.0, "noise_scale": 0.05,
        "seasonal_amplitude": 80.0, "drift_rate": 20.0,
        "ac_threshold": 26.0, "ac_sensitivity": 200.0,
        "weekday_peaks": [
            {"center_slot": 20, "amplitude": 1100.0, "width": 4.0},
            {"center_slot": 48, "amplitude": 550.0, "width": 3.0},
            {"center_slot": 72, "amplitude": 1800.0, "width": 6.0},
        ],
        "weekend_peaks": [
            {"center_slot": 28, "amplitude": 900.0, "width": 4.0},
            {"center_slot": 52, "amplitude": 600.0, "width": 3.0},
            {"center_slot": 76, "amplitude": 1650.0, "width": 6.0},
        ],
    },
]

# Anomaly configuration
BASELINE_ANOMALIES_PER_HOUSEHOLD = 30
ADVANCED_ANOMALIES_PER_HOUSEHOLD = 40
ANOMALY_MULTIPLIERS = [2.0, 2.5, 3.0]
ANOMALY_DURATION_READINGS = 3
ANOMALY_MIN_SEPARATION_HOURS = 6
ADVANCED_ANOMALY_MIN_SEPARATION_HOURS = 4

# Missing data configuration (baseline)
MISSING_RATE = 0.02
CONTIGUOUS_GAPS_PER_HOUSEHOLD = 5
CONTIGUOUS_GAP_LENGTHS = [2, 3, 4]

# Advanced-specific
DEFAULT_DAYS = 90
APPLIANCE_HIGH_RATE = 0.3   # per hour during waking hours
APPLIANCE_LOW_RATE = 1.5    # per hour continuous
SENSOR_DEGRADATION_NOISE_MULTIPLIER = 5.0


# ============================================================================
# Utility Functions
# ============================================================================

def get_rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def build_timestamp_range(start_date: str, days: int) -> pd.DatetimeIndex:
    start = pd.Timestamp(start_date, tz="UTC")
    end = start + timedelta(days=days)
    return pd.date_range(start=start, end=end, freq="15min", inclusive="left")


def slot_index(ts: pd.Timestamp) -> int:
    return ts.hour * 4 + ts.minute // 15


def is_weekend(ts: pd.Timestamp) -> bool:
    return ts.dayofweek >= 5


def gaussian(x: np.ndarray, center: float, amplitude: float, width: float) -> np.ndarray:
    return amplitude * np.exp(-((x - center) ** 2) / (2 * width ** 2))


# ============================================================================
# Diurnal Template
# ============================================================================

def compute_diurnal_template(
    household: Dict[str, Any],
    timestamps: pd.DatetimeIndex,
    rng: np.random.Generator,
    advanced: bool = False,
) -> np.ndarray:
    base_load = household["base_load"]
    weekday_peaks = household["weekday_peaks"]
    weekend_peaks = household["weekend_peaks"]

    slots = np.array([slot_index(ts) for ts in timestamps], dtype=np.float64)
    weekend_mask = np.array([is_weekend(ts) for ts in timestamps])

    template = np.full(len(timestamps), base_load, dtype=np.float64)

    weekday_idx = np.where(~weekend_mask)[0]
    if len(weekday_idx) > 0:
        for peak in weekday_peaks:
            template[weekday_idx] += gaussian(
                slots[weekday_idx],
                center=peak["center_slot"],
                amplitude=peak["amplitude"],
                width=peak["width"],
            )

    weekend_idx = np.where(weekend_mask)[0]
    if len(weekend_idx) > 0:
        for peak in weekend_peaks:
            template[weekend_idx] += gaussian(
                slots[weekend_idx],
                center=peak["center_slot"],
                amplitude=peak["amplitude"],
                width=peak["width"],
            )

    # Advanced: day-to-day amplitude variation (±5%)
    if advanced:
        day_indices = timestamps.dayofyear - timestamps.dayofyear.min()
        for day in np.unique(day_indices):
            day_mask = day_indices == day
            scale = 1.0 + rng.normal(0, 0.05)
            excess = template[day_mask] - base_load
            template[day_mask] = base_load + excess * scale

    return template


# ============================================================================
# Advanced: Long-Term Trend (Section 4.4)
# ============================================================================

def compute_trend(
    household: Dict[str, Any],
    timestamps: pd.DatetimeIndex,
    total_days: int,
) -> np.ndarray:
    t_days = (timestamps - timestamps[0]).total_seconds() / 86400.0
    seasonal = household["seasonal_amplitude"] * np.sin(
        2 * np.pi * t_days / 90.0 + np.radians(household.get("phase_offset", 0))
    )
    linear = household["drift_rate"] * t_days / total_days
    return seasonal + linear


# ============================================================================
# Advanced: Appliance Events (Section 4.5)
# ============================================================================

def generate_appliance_events(
    timestamps: pd.DatetimeIndex,
    rng: np.random.Generator,
) -> np.ndarray:
    n = len(timestamps)
    signal = np.zeros(n, dtype=np.float64)
    interval_hours = 0.25

    for i in range(n):
        hour = timestamps[i].hour
        # High-draw events: waking hours only (06:00-22:00)
        if 6 <= hour < 22:
            if rng.random() < APPLIANCE_HIGH_RATE * interval_hours:
                peak = rng.lognormal(mean=np.log(800), sigma=0.8)
                duration_slots = max(1, int(rng.exponential(scale=2.0)))  # mean 30 min = 2 slots
                decay = peak
                for j in range(min(duration_slots, n - i)):
                    signal[i + j] += decay
                    decay *= np.exp(-interval_hours / (duration_slots * interval_hours / 3))
        # Low-draw events: all hours
        if rng.random() < APPLIANCE_LOW_RATE * interval_hours:
            peak = rng.lognormal(mean=np.log(200), sigma=0.5)
            duration_slots = max(1, int(rng.exponential(scale=1.0)))  # mean 15 min = 1 slot
            decay = peak
            for j in range(min(duration_slots, n - i)):
                signal[i + j] += decay
                decay *= np.exp(-interval_hours / (duration_slots * interval_hours / 3))

    return signal


# ============================================================================
# Advanced: Temperature Model (Section 4.7)
# ============================================================================

def generate_temperature(
    timestamps: pd.DatetimeIndex,
    rng: np.random.Generator,
) -> np.ndarray:
    n = len(timestamps)
    unique_days = timestamps.floor("D").unique()
    n_days = len(unique_days)

    # AR(1) weather component
    weather = np.zeros(n_days)
    for d in range(1, n_days):
        weather[d] = 0.7 * weather[d - 1] + rng.normal(0, 1.5)

    # Map to timestamps
    day_indices = (timestamps - timestamps[0]).days
    weather_series = weather[day_indices.to_series().clip(0, n_days - 1).values]

    # Diurnal cycle
    hours = timestamps.hour + timestamps.minute / 60.0
    diurnal = 4.0 * np.sin(2 * np.pi * (hours - 14) / 24)

    return 27.0 + diurnal + weather_series


# ============================================================================
# Advanced: Weather Coupling (Section 4.6)
# ============================================================================

def compute_weather_coupling(
    household: Dict[str, Any],
    temperature: np.ndarray,
) -> np.ndarray:
    excess = np.maximum(0, temperature - household["ac_threshold"])
    return household["ac_sensitivity"] * excess


# ============================================================================
# Noise Generation
# ============================================================================

def generate_noise(
    size: int,
    noise_std: float,
    rng: np.random.Generator,
    template: np.ndarray = None,
    noise_std_base: float = None,
    noise_scale: float = None,
) -> np.ndarray:
    # Advanced: heteroskedastic noise
    if template is not None and noise_std_base is not None and noise_scale is not None:
        std = np.sqrt(noise_std_base ** 2 + (noise_scale * template) ** 2)
        return rng.normal(0, 1, size) * std
    # Baseline: constant-variance noise
    return rng.normal(0, noise_std, size)


# ============================================================================
# Missing Data
# ============================================================================

def inject_missing_data_baseline(
    df: pd.DataFrame,
    rng: np.random.Generator,
) -> Tuple[pd.DataFrame, np.ndarray]:
    n = len(df)
    keep_mask = np.ones(n, dtype=bool)
    dropout_mask = rng.random(n) < MISSING_RATE
    keep_mask[dropout_mask] = False
    for _ in range(CONTIGUOUS_GAPS_PER_HOUSEHOLD):
        gap_length = int(rng.choice(CONTIGUOUS_GAP_LENGTHS))
        max_start = n - gap_length
        if max_start <= 0:
            continue
        gap_start = rng.integers(0, max_start)
        keep_mask[gap_start:gap_start + gap_length] = False
    return df.loc[keep_mask].copy(), keep_mask


def inject_missing_data_advanced(
    df: pd.DataFrame,
    rng: np.random.Generator,
    sensor_issues: List[Dict[str, Any]],
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    n = len(df)
    keep_mask = np.ones(n, dtype=bool)
    is_degraded = np.zeros(n, dtype=bool)

    # Correlated burst dropouts
    prev_gap = False
    for i in range(n):
        if prev_gap:
            if rng.random() < 0.4:
                keep_mask[i] = False
                prev_gap = True
            else:
                prev_gap = False
        else:
            if rng.random() < 0.01:
                keep_mask[i] = False
                prev_gap = True

    # Sensor degradation event (once per household)
    deg_start = rng.integers(0, max(1, n - 48))
    deg_duration = rng.integers(24, 49)  # 6-12 hours in 15-min slots
    deg_end = min(deg_start + deg_duration, n)
    is_degraded[deg_start:deg_end] = True
    sensor_issues.append({
        "issue_id": f"deg_{df['device_id'].iloc[0]}_{deg_start:06d}",
        "device_id": df["device_id"].iloc[0],
        "start_timestamp": df.iloc[deg_start]["timestamp"],
        "end_timestamp": df.iloc[deg_end - 1]["timestamp"],
        "issue_type": "SENSOR_DEGRADATION",
    })

    # Zero-reading period (once per household)
    zero_start = rng.integers(0, max(1, n - 12))
    zero_duration = rng.integers(4, 13)  # 1-3 hours
    zero_end = min(zero_start + zero_duration, n)
    sensor_issues.append({
        "issue_id": f"zero_{df['device_id'].iloc[0]}_{zero_start:06d}",
        "device_id": df["device_id"].iloc[0],
        "start_timestamp": df.iloc[zero_start]["timestamp"],
        "end_timestamp": df.iloc[zero_end - 1]["timestamp"],
        "issue_type": "ZERO_READING_PERIOD",
    })

    # Apply degradation noise
    if is_degraded.any():
        noise_mult = SENSOR_DEGRADATION_NOISE_MULTIPLIER
        df.loc[is_degraded, "avg_wattage"] += rng.normal(
            0, df.loc[is_degraded, "avg_wattage"].std() * noise_mult,
            size=is_degraded.sum()
        )
        df.loc[is_degraded, "avg_wattage"] = np.maximum(0, df.loc[is_degraded, "avg_wattage"])

    # Apply zero readings
    df.loc[zero_start:zero_end - 1, "avg_wattage"] = 0.0

    result_df = df.loc[keep_mask].copy()
    sensor_df = pd.DataFrame(sensor_issues)
    return result_df, sensor_df


# ============================================================================
# Anomaly Injection
# ============================================================================

def inject_anomalies_baseline(
    df: pd.DataFrame,
    timestamps: pd.DatetimeIndex,
    user_account_id: str,
    device_id: str,
    anomaly_rng: np.random.Generator,
    num_anomalies: int = BASELINE_ANOMALIES_PER_HOUSEHOLD,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    n = len(df)
    min_sep = ANOMALY_MIN_SEPARATION_HOURS * 4
    return _inject_spike_anomalies(df, user_account_id, device_id, anomaly_rng, num_anomalies, min_sep)


def inject_anomalies_advanced(
    df: pd.DataFrame,
    template: np.ndarray,
    user_account_id: str,
    device_id: str,
    anomaly_rng: np.random.Generator,
    num_anomalies: int = ADVANCED_ANOMALIES_PER_HOUSEHOLD,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    n = len(df)
    min_sep = ADVANCED_ANOMALY_MIN_SEPARATION_HOURS * 4
    records = []

    # Type 1: Spike (30% = 12)
    n_type1 = int(num_anomalies * 0.30)
    starts = _select_anomaly_starts(n, n_type1, min_sep, anomaly_rng, duration=3)
    for s in starts:
        mult = float(anomaly_rng.choice(ANOMALY_MULTIPLIERS))
        df.iloc[s:s+3, df.columns.get_loc("avg_wattage")] *= mult
        records.append({
            "anomaly_id": f"anom_{user_account_id}_{s:06d}",
            "device_id": device_id, "user_account_id": user_account_id,
            "start_timestamp": df.iloc[s]["timestamp"],
            "end_timestamp": df.iloc[min(s+2, n-1)]["timestamp"],
            "anomaly_type": "MULTIPLICATIVE_SPIKE",
            "multiplier": mult, "delta_watts": np.nan,
        })

    # Type 2: Drift (25% = 10)
    n_type2 = int(num_anomalies * 0.25)
    starts = _select_anomaly_starts(n, n_type2, min_sep, anomaly_rng, duration=144)  # 36h = 144 slots
    for s in starts:
        delta = anomaly_rng.uniform(300, 800)
        ramp_slots = 48  # 12 hours
        total_slots = 144  # 36 hours
        for offset in range(min(total_slots, n - s)):
            ramp_factor = min(1.0, offset / ramp_slots)
            if offset < total_slots - 48:  # ramp + sustain
                df.iloc[s + offset, df.columns.get_loc("avg_wattage")] += delta * ramp_factor
            else:  # ramp down
                down_factor = 1.0 - (offset - (total_slots - 48)) / 48
                df.iloc[s + offset, df.columns.get_loc("avg_wattage")] += delta * max(0, down_factor)
        records.append({
            "anomaly_id": f"anom_{user_account_id}_{s:06d}",
            "device_id": device_id, "user_account_id": user_account_id,
            "start_timestamp": df.iloc[s]["timestamp"],
            "end_timestamp": df.iloc[min(s+total_slots-1, n-1)]["timestamp"],
            "anomaly_type": "BASELINE_DRIFT",
            "multiplier": np.nan, "delta_watts": delta,
        })

    # Type 3: Off-Peak (25% = 10)
    n_type3 = int(num_anomalies * 0.25)
    off_peak_candidates = [
        i for i in range(n - 6)
        if 0 <= df.iloc[i]["timestamp"].hour < 5
    ]
    if off_peak_candidates:
        starts = _select_anomaly_starts_from_candidates(
            off_peak_candidates, n_type3, min_sep, anomaly_rng, duration=6
        )
        for s in starts:
            mult = anomaly_rng.uniform(2.5, 3.5)
            df.iloc[s:s+6, df.columns.get_loc("avg_wattage")] *= mult
            records.append({
                "anomaly_id": f"anom_{user_account_id}_{s:06d}",
                "device_id": device_id, "user_account_id": user_account_id,
                "start_timestamp": df.iloc[s]["timestamp"],
                "end_timestamp": df.iloc[min(s+5, n-1)]["timestamp"],
                "anomaly_type": "OFF_PEAK",
                "multiplier": mult, "delta_watts": np.nan,
            })

    # Type 4: Missing Reduction (20% = 8)
    n_type4 = num_anomalies - len(records)
    trough_candidates = [
        i for i in range(n - 16)
        if 10 <= df.iloc[i]["timestamp"].hour <= 15  # midday trough window
    ]
    if trough_candidates:
        starts = _select_anomaly_starts_from_candidates(
            trough_candidates, n_type4, min_sep, anomaly_rng, duration=16
        )
        for s in starts:
            window_peak = np.max(template[s:s+16])
            floor_value = 0.7 * window_peak
            for offset in range(16):
                if s + offset < n:
                    current = df.iloc[s + offset, df.columns.get_loc("avg_wattage")]
                    df.iloc[s + offset, df.columns.get_loc("avg_wattage")] = max(current, floor_value)
            records.append({
                "anomaly_id": f"anom_{user_account_id}_{s:06d}",
                "device_id": device_id, "user_account_id": user_account_id,
                "start_timestamp": df.iloc[s]["timestamp"],
                "end_timestamp": df.iloc[min(s+15, n-1)]["timestamp"],
                "anomaly_type": "MISSING_REDUCTION",
                "multiplier": np.nan, "delta_watts": np.nan,
            })

    anomaly_df = pd.DataFrame(records)
    return df, anomaly_df


def _select_anomaly_starts(n: int, count: int, min_sep: int, rng: np.random.Generator, duration: int = 3) -> List[int]:
    candidates = list(range(n - duration + 1))
    return _pick_starts(candidates, count, min_sep, rng)


def _select_anomaly_starts_from_candidates(
    candidates: List[int], count: int, min_sep: int, rng: np.random.Generator, duration: int = 3
) -> List[int]:
    valid = [c for c in candidates if c + duration <= max(candidates) + duration]
    return _pick_starts(valid, count, min_sep, rng)


def _pick_starts(candidates: List[int], count: int, min_sep: int, rng: np.random.Generator) -> List[int]:
    selected = []
    for _ in range(count):
        valid = [c for c in candidates if all(abs(c - s) >= min_sep for s in selected)]
        if not valid:
            break
        chosen = int(rng.choice(valid))
        selected.append(chosen)
    return selected


def _inject_spike_anomalies(
    df: pd.DataFrame,
    user_account_id: str,
    device_id: str,
    anomaly_rng: np.random.Generator,
    num_anomalies: int,
    min_sep: int,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    n = len(df)
    starts = _select_anomaly_starts(n, num_anomalies, min_sep, anomaly_rng, duration=ANOMALY_DURATION_READINGS)
    records = []
    for s in starts:
        mult = float(anomaly_rng.choice(ANOMALY_MULTIPLIERS))
        df.iloc[s:s+ANOMALY_DURATION_READINGS, df.columns.get_loc("avg_wattage")] *= mult
        records.append({
            "anomaly_id": f"anom_{user_account_id}_{s:06d}",
            "device_id": device_id,
            "user_account_id": user_account_id,
            "start_timestamp": df.iloc[s]["timestamp"],
            "end_timestamp": df.iloc[min(s+ANOMALY_DURATION_READINGS-1, n-1)]["timestamp"],
            "anomaly_type": "MULTIPLICATIVE_SPIKE",
            "multiplier": mult,
            "delta_watts": np.nan,
        })
    return df, pd.DataFrame(records)


# ============================================================================
# OCR Bill Generation
# ============================================================================

def generate_ocr_bills(
    all_readings: pd.DataFrame,
    bill_rng: np.random.Generator,
) -> pd.DataFrame:
    df = all_readings.copy()
    df["month"] = df["timestamp"].dt.to_period("M")
    records = []
    for (user_id, device_id, meralco_num), group in df.groupby(
        ["user_account_id", "device_id", "meralco_account_number"]
    ):
        for month, month_data in group.groupby("month"):
            total_kwh_base = (month_data["avg_wattage"].sum() * 0.25) / 1000.0
            delta = bill_rng.normal(0, 0.02 * max(total_kwh_base, 0.01))
            total_kwh = round(total_kwh_base + delta, 2)
            total_bill = round(total_kwh * RATE_PESOS_PER_KWH, 2)
            next_month = month + 1
            scan_ts = pd.Timestamp(year=next_month.year, month=next_month.month, day=1, hour=9, minute=0, tz="UTC")
            records.append({
                "user_account_id": user_id,
                "scan_timestamp": scan_ts,
                "meralco_account_number": meralco_num,
                "billing_period": month.strftime("%B %Y"),
                "total_kwh_consumed": total_kwh,
                "total_bill_php": total_bill,
            })
    return pd.DataFrame(records)


# ============================================================================
# Pipeline Runners
# ============================================================================

def generate_baseline_dataset(
    output_dir: Path,
    days: int = DEFAULT_DAYS,
    start_date: str = "2024-03-01",
    master_seed: int = MASTER_SEED,
) -> None:
    raw_dir = output_dir / "baseline" / "raw"
    metadata_dir = output_dir / "baseline" / "metadata"
    raw_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    timestamps = build_timestamp_range(start_date, days)
    anomaly_rng = get_rng(master_seed + 9999)
    bill_rng = get_rng(master_seed + 7777)
    all_anomalies, all_readings = [], []

    for hh_idx, household in enumerate(BASELINE_HOUSEHOLDS):
        user_id = household["user_account_id"]
        device_id = household["device_id"]
        meralco_num = f"{1234567890 + hh_idx:010d}"
        hh_rng = get_rng(master_seed + hh_idx * 1000)

        template = compute_diurnal_template(household, timestamps, hh_rng, advanced=False)
        noise = generate_noise(len(timestamps), household["noise_std"], hh_rng)
        wattage = np.maximum(0.0, template + noise)

        df = pd.DataFrame({
            "device_id": device_id, "user_account_id": user_id,
            "timestamp": timestamps, "avg_wattage": wattage,
            "reading_interval_minutes": READING_INTERVAL_MINUTES,
        })

        df, anomaly_df = inject_anomalies_baseline(df, timestamps, user_id, device_id, anomaly_rng)
        all_anomalies.append(anomaly_df)
        df, _ = inject_missing_data_baseline(df, hh_rng)
        df["meralco_account_number"] = meralco_num

        save_df = df.drop(columns=["meralco_account_number"])
        save_df.to_parquet(raw_dir / f"{device_id}.parquet", index=False)
        print(f"  ✓ {raw_dir / f'{device_id}.parquet'} ({len(save_df)} rows)")
        all_readings.append(df)

    combined_readings = pd.concat(all_readings, ignore_index=True)
    combined_anomalies = pd.concat(all_anomalies, ignore_index=True)
    combined_anomalies.to_parquet(metadata_dir / "anomaly_ground_truth.parquet", index=False)
    print(f"  ✓ {metadata_dir / 'anomaly_ground_truth.parquet'} ({len(combined_anomalies)} anomalies)")

    ocr_bills = generate_ocr_bills(combined_readings, bill_rng)
    ocr_bills.to_parquet(raw_dir / "ocr_bills.parquet", index=False)
    print(f"  ✓ {raw_dir / 'ocr_bills.parquet'} ({len(ocr_bills)} bills)")

    with open(metadata_dir / "household_profiles.json", "w") as f:
        json.dump(BASELINE_HOUSEHOLDS, f, indent=2, default=str)
    with open(metadata_dir / "generation_log.json", "w") as f:
        json.dump({
            "dataset_type": "baseline", "master_seed": master_seed,
            "start_date": start_date, "days": days,
            "households": len(BASELINE_HOUSEHOLDS),
            "actual_anomalies": len(combined_anomalies),
            "actual_readings": len(combined_readings),
        }, f, indent=2, default=str)

    print(f"\nBaseline dataset generated in {output_dir / 'baseline'}")


def generate_advanced_dataset(
    output_dir: Path,
    days: int = DEFAULT_DAYS,
    start_date: str = "2024-03-01",
    master_seed: int = MASTER_SEED,
) -> None:
    raw_dir = output_dir / "advanced" / "raw"
    metadata_dir = output_dir / "advanced" / "metadata"
    raw_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    timestamps = build_timestamp_range(start_date, days)
    anomaly_rng = get_rng(master_seed + 9999)
    bill_rng = get_rng(master_seed + 7777)
    temp_rng = get_rng(master_seed + 5555)
    all_anomalies, all_readings, all_sensor_issues = [], [], []

    # Generate shared temperature series
    temperature = generate_temperature(timestamps, temp_rng)
    temp_df = pd.DataFrame({"timestamp": timestamps, "temperature_celsius": temperature})
    temp_df.to_parquet(metadata_dir / "temperature_manila.parquet", index=False)
    print(f"  ✓ {metadata_dir / 'temperature_manila.parquet'}")

    for hh_idx, household in enumerate(ADVANCED_HOUSEHOLDS):
        user_id = household["user_account_id"]
        device_id = household["device_id"]
        meralco_num = f"{2234567890 + hh_idx:010d}"
        hh_rng = get_rng(master_seed + hh_idx * 1000)

        # Components
        template = compute_diurnal_template(household, timestamps, hh_rng, advanced=True)
        trend = compute_trend(household, timestamps, days)
        appliances = generate_appliance_events(timestamps, hh_rng)
        weather = compute_weather_coupling(household, temperature)
        noise = generate_noise(
            len(timestamps), 0, hh_rng,
            template=template + trend + weather + appliances,
            noise_std_base=household["noise_std_base"],
            noise_scale=household["noise_scale"],
        )

        wattage = np.maximum(0.0, template + trend + appliances + weather + noise)

        df = pd.DataFrame({
            "device_id": device_id, "user_account_id": user_id,
            "timestamp": timestamps, "avg_wattage": wattage,
            "reading_interval_minutes": READING_INTERVAL_MINUTES,
        })

        df, anomaly_df = inject_anomalies_advanced(df, template, user_id, device_id, anomaly_rng)
        all_anomalies.append(anomaly_df)

        sensor_issues: List[Dict] = []
        df, sensor_df = inject_missing_data_advanced(df, hh_rng, sensor_issues)
        if len(sensor_df) > 0:
            all_sensor_issues.append(sensor_df)

        df["meralco_account_number"] = meralco_num
        save_df = df.drop(columns=["meralco_account_number"])
        save_df.to_parquet(raw_dir / f"{device_id}.parquet", index=False)
        print(f"  ✓ {raw_dir / f'{device_id}.parquet'} ({len(save_df)} rows)")
        all_readings.append(df)

    combined_readings = pd.concat(all_readings, ignore_index=True)
    combined_anomalies = pd.concat(all_anomalies, ignore_index=True)
    combined_anomalies.to_parquet(metadata_dir / "anomaly_ground_truth.parquet", index=False)
    print(f"  ✓ {metadata_dir / 'anomaly_ground_truth.parquet'} ({len(combined_anomalies)} anomalies)")

    if all_sensor_issues:
        combined_sensors = pd.concat(all_sensor_issues, ignore_index=True)
        combined_sensors.to_parquet(metadata_dir / "sensor_issue_ground_truth.parquet", index=False)
        print(f"  ✓ {metadata_dir / 'sensor_issue_ground_truth.parquet'} ({len(combined_sensors)} issues)")

    ocr_bills = generate_ocr_bills(combined_readings, bill_rng)
    ocr_bills.to_parquet(raw_dir / "ocr_bills.parquet", index=False)
    print(f"  ✓ {raw_dir / 'ocr_bills.parquet'} ({len(ocr_bills)} bills)")

    with open(metadata_dir / "household_profiles.json", "w") as f:
        json.dump(ADVANCED_HOUSEHOLDS, f, indent=2, default=str)
    with open(metadata_dir / "generation_log.json", "w") as f:
        json.dump({
            "dataset_type": "advanced", "master_seed": master_seed,
            "start_date": start_date, "days": days,
            "households": len(ADVANCED_HOUSEHOLDS),
            "actual_anomalies": len(combined_anomalies),
            "actual_readings": len(combined_readings),
        }, f, indent=2, default=str)

    print(f"\nAdvanced dataset generated in {output_dir / 'advanced'}")


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Generate synthetic energy consumption data.")
    parser.add_argument("--dataset", choices=["baseline", "advanced", "both"], default="both")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS)
    parser.add_argument("--output", type=str, default="data/synthetic")
    parser.add_argument("--seed", type=int, default=MASTER_SEED)
    parser.add_argument("--start-date", type=str, default="2024-03-01")
    args = parser.parse_args()

    output_dir = Path(args.output)

    print("=" * 60)
    print("Synthetic Data Generator — Residential Energy Anomaly Detection")
    print("=" * 60)
    print(f"Dataset: {args.dataset} | Days: {args.days} | Seed: {args.seed}")
    print(f"Output:  {output_dir.resolve()}")
    print("-" * 60)

    if args.dataset in ("baseline", "both"):
        generate_baseline_dataset(output_dir, args.days, args.start_date, args.seed)
    if args.dataset in ("advanced", "both"):
        generate_advanced_dataset(output_dir, args.days, args.start_date, args.seed)

    print("=" * 60)
    print("Generation complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
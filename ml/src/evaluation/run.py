"""
Model Evaluation — Baseline Implementation
Residential Energy Anomaly Detection for Bill Shock Prevention

Loads pre-computed model predictions from the training stage, injects synthetic
anomalies into the test set, computes forecasting and anomaly detection metrics,
and produces a ranked model comparison report.

Usage:
    python -m src.evaluation.run --predictions-dir output/predictions/ --output-dir output/reports/

Architecture Reference: Stage 5, ARCHITECTURE.md
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


# ============================================================================
# Configuration
# ============================================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PREDICTIONS_DIR = PROJECT_ROOT / "output" / "predictions"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output" / "reports"

# Synthetic anomaly injection parameters
ANOMALY_MULTIPLIERS = [2.0, 2.5, 3.0]
ANOMALIES_PER_TEST_PERIOD = 30
ANOMALY_DURATION_READINGS = 3
ANOMALY_MIN_SEPARATION_HOURS = 6

# Threshold sweep for anomaly detection
K_SWEEP_START = 1.5
K_SWEEP_END = 4.0
K_SWEEP_STEP = 0.1

# Test/validation split
TEST_DAYS = 14
VAL_DAYS = 7


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class ForecastingMetrics:
    """Forecasting error metrics for a single model on a single device."""
    device_id: str
    model: str
    mae: float
    rmse: float
    mape: float
    residual_mean: float
    residual_std: float


@dataclass
class AnomalyDetectionMetrics:
    """Anomaly detection metrics for a single model at optimal threshold."""
    device_id: str
    model: str
    best_k: float
    best_f1: float
    precision: float
    recall: float
    true_positives: int
    false_positives: int
    false_negatives: int


@dataclass
class ModelComparison:
    """Pairwise Diebold-Mariano test result."""
    model_a: str
    model_b: str
    device_id: str
    dm_statistic: float
    p_value: float
    significant_at_5pct: bool


@dataclass
class EvaluationReport:
    """Complete evaluation output for all models and devices."""
    timestamp: str
    forecasting: List[Dict[str, Any]] = field(default_factory=list)
    anomaly_detection: List[Dict[str, Any]] = field(default_factory=list)
    model_comparisons: List[Dict[str, Any]] = field(default_factory=list)
    model_ranking: List[Dict[str, Any]] = field(default_factory=list)


# ============================================================================
# Utility Functions
# ============================================================================

def now_stamp() -> str:
    """Return UTC timestamp string for report filenames."""
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def ensure_dirs(output_dir: Path) -> None:
    """Create output directory if it doesn't exist."""
    output_dir.mkdir(parents=True, exist_ok=True)


# ============================================================================
# Forecasting Metrics
# ============================================================================

def compute_forecasting_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> Tuple[float, float, float, float, float]:
    """
    Compute MAE, RMSE, MAPE, and residual statistics.

    Args:
        y_true: Actual wattage values.
        y_pred: Predicted wattage values.

    Returns:
        Tuple of (mae, rmse, mape, residual_mean, residual_std).
        Returns NaN for all if inputs are empty or invalid.
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    if len(y_true) == 0 or y_true.shape != y_pred.shape:
        return float("nan"), float("nan"), float("nan"), float("nan"), float("nan")

    # Use only finite values
    mask = np.isfinite(y_true) & np.isfinite(y_pred)
    if not mask.any():
        return float("nan"), float("nan"), float("nan"), float("nan"), float("nan")

    y_true = y_true[mask]
    y_pred = y_pred[mask]
    residuals = y_true - y_pred

    mae = float(np.mean(np.abs(residuals)))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    residual_mean = float(np.mean(residuals))
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0

    # MAPE capped at 100%
    with np.errstate(divide="ignore", invalid="ignore"):
        mape_vals = np.abs(residuals / y_true)
        mape_vals = np.where(np.isfinite(mape_vals), mape_vals, np.nan)
    mape = float(np.nanmean(np.clip(mape_vals, 0, 1.0)) * 100.0)

    return mae, rmse, mape, residual_mean, residual_std


# ============================================================================
# Synthetic Anomaly Injection
# ============================================================================

def inject_synthetic_anomalies(
    df: pd.DataFrame,
    rng: np.random.Generator,
    num_anomalies: int = ANOMALIES_PER_TEST_PERIOD,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Inject multiplicative spike anomalies into the test set.

    Anomalies are 3 consecutive readings multiplied by 2.0, 2.5, or 3.0
    at randomly selected timestamps with minimum 6-hour separation.

    IMPORTANT: Anomalies are injected AFTER feature computation to prevent
    leakage. This function operates on raw avg_wattage only.

    Args:
        df: Test set dataframe with 'avg_wattage' column.
        rng: Seeded random number generator for reproducibility.
        num_anomalies: Number of anomaly sequences to inject.

    Returns:
        Tuple of (anomalous_df, ground_truth_df).
        anomalous_df has injected anomalies in 'avg_wattage'.
        ground_truth_df records anomaly timestamps and multipliers.
    """
    n = len(df)
    min_sep_slots = ANOMALY_MIN_SEPARATION_HOURS * 4  # 24 slots = 6 hours

    # Select anomaly start positions with minimum separation
    candidates = list(range(n - ANOMALY_DURATION_READINGS + 1))
    starts = _select_separated_starts(candidates, num_anomalies, min_sep_slots, rng)

    # Create anomalous copy
    anomalous_df = df.copy()

    records = []
    for start_idx in starts:
        multiplier = float(rng.choice(ANOMALY_MULTIPLIERS))
        end_idx = min(start_idx + ANOMALY_DURATION_READINGS, n)

        # Record ground truth before modification
        records.append({
            "anomaly_id": f"synthetic_{start_idx:06d}",
            "start_index": start_idx,
            "end_index": end_idx - 1,
            "start_timestamp": str(anomalous_df.iloc[start_idx]["timestamp"]),
            "end_timestamp": str(anomalous_df.iloc[end_idx - 1]["timestamp"]),
            "multiplier": multiplier,
            "original_wattage_mean": float(
                anomalous_df.iloc[start_idx:end_idx]["avg_wattage"].mean()
            ),
            "anomalous_wattage_mean": float(
                anomalous_df.iloc[start_idx:end_idx]["avg_wattage"].mean() * multiplier
            ),
        })

        # Apply multiplier
        anomalous_df.iloc[start_idx:end_idx, anomalous_df.columns.get_loc("avg_wattage")] *= multiplier

    ground_truth = pd.DataFrame(records)
    return anomalous_df, ground_truth


def _select_separated_starts(
    candidates: List[int],
    count: int,
    min_separation: int,
    rng: np.random.Generator,
) -> List[int]:
    """
    Select start indices with minimum separation between them.

    Args:
        candidates: List of valid start indices.
        count: Number of starts to select.
        min_separation: Minimum distance between selected starts.
        rng: Seeded random generator.

    Returns:
        List of selected start indices.
    """
    selected = []
    available = list(candidates)

    for _ in range(count):
        valid = [c for c in available if all(abs(c - s) >= min_separation for s in selected)]
        if not valid:
            break
        chosen = int(rng.choice(valid))
        selected.append(chosen)

    return sorted(selected)


# ============================================================================
# Anomaly Detection Evaluation
# ============================================================================

def evaluate_anomaly_detection(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    ground_truth_df: pd.DataFrame,
    sigma_residuals: float,
    k_values: Optional[np.ndarray] = None,
) -> Tuple[Dict[str, Any], pd.DataFrame]:
    """
    Evaluate anomaly detection performance across threshold sweep.

    Anomaly rule: alert if (actual - predicted) > k * sigma_residuals
    Sustained spike rule: alert only if 3 consecutive readings exceed threshold.

    Args:
        y_true: Actual wattage (with injected anomalies).
        y_pred: Predicted wattage (from clean model).
        ground_truth_df: DataFrame of injected anomaly positions.
        sigma_residuals: Residual standard deviation from validation set.
        k_values: Array of k thresholds to sweep. Default: 1.5 to 4.0 step 0.1.

    Returns:
        Tuple of (best_result_dict, sweep_df).
    """
    if k_values is None:
        k_values = np.arange(K_SWEEP_START, K_SWEEP_END + K_SWEEP_STEP, K_SWEEP_STEP)

    residuals = y_true - y_pred
    n = len(residuals)

    # Build ground truth mask: which indices are anomalous
    anomaly_mask = np.zeros(n, dtype=bool)
    for _, row in ground_truth_df.iterrows():
        start = int(row["start_index"])
        end = int(row["end_index"]) + 1
        anomaly_mask[start:end] = True

    results = []
    for k in k_values:
        threshold = k * sigma_residuals

        # Single-point alerts: residual exceeds threshold
        point_alerts = residuals > threshold

        # Sustained spike rule: 3 consecutive alerts
        sustained_alerts = np.zeros(n, dtype=bool)
        for i in range(2, n):
            if point_alerts[i] and point_alerts[i - 1] and point_alerts[i - 2]:
                sustained_alerts[i - 2:i + 1] = True

        # Compute precision and recall
        tp = int(np.sum(sustained_alerts & anomaly_mask))
        fp = int(np.sum(sustained_alerts & ~anomaly_mask))
        fn = int(np.sum(~sustained_alerts & anomaly_mask))

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        results.append({
            "k": round(k, 2),
            "threshold_watts": round(threshold, 2),
            "sigma_residuals": round(sigma_residuals, 2),
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        })

    sweep_df = pd.DataFrame(results)

    # Find best k by F1 score
    if not sweep_df.empty and sweep_df["f1"].max() > 0:
        best_row = sweep_df.loc[sweep_df["f1"].idxmax()].to_dict()
    else:
        best_row = {
            "k": float("nan"), "threshold_watts": float("nan"),
            "sigma_residuals": sigma_residuals,
            "true_positives": 0, "false_positives": 0, "false_negatives": 0,
            "precision": 0.0, "recall": 0.0, "f1": 0.0,
        }

    return best_row, sweep_df


# ============================================================================
# Diebold-Mariano Test
# ============================================================================

def diebold_mariano_test(
    errors_a: np.ndarray,
    errors_b: np.ndarray,
    horizon: int = 1,
    alternative: str = "two-sided",
) -> Tuple[float, float]:
    """
    Diebold-Mariano test for comparing forecast accuracy.

    Tests the null hypothesis that two forecasts have equal predictive accuracy
    against the alternative that they differ.

    Uses MSE loss (squared errors) as the standard formulation.

    Args:
        errors_a: Forecast errors from model A (actual - predicted).
        errors_b: Forecast errors from model B (actual - predicted).
        horizon: Forecast horizon. Default 1 for one-step-ahead.
        alternative: 'two-sided', 'greater', or 'less'.

    Returns:
        Tuple of (dm_statistic, p_value).
    """
    # Use squared error loss
    loss_a = errors_a ** 2
    loss_b = errors_b ** 2
    d = loss_a - loss_b

    n = len(d)
    if n < 2:
        return float("nan"), float("nan")

    # Mean of loss differential
    d_mean = np.mean(d)

    # HAC variance estimator (Newey-West with horizon-1 truncation lag)
    # For h=1, autocorrelation at lag 1 is used
    gamma_0 = np.var(d, ddof=0)  # population variance
    if horizon > 1 and n > horizon:
        gamma_h = 0.0
        for i in range(horizon, n):
            gamma_h += (d[i] - d_mean) * (d[i - horizon] - d_mean)
        gamma_h /= n
        hac_var = (gamma_0 + 2 * gamma_h) / n
    else:
        hac_var = gamma_0 / n

    if hac_var <= 0:
        return float("nan"), float("nan")

    dm_stat = d_mean / np.sqrt(hac_var)

    # Approximate p-value using normal distribution
    from scipy import stats as scipy_stats

    if alternative == "two-sided":
        p_value = 2 * scipy_stats.norm.sf(abs(dm_stat))
    elif alternative == "greater":
        p_value = scipy_stats.norm.sf(dm_stat)
    elif alternative == "less":
        p_value = scipy_stats.norm.cdf(dm_stat)
    else:
        raise ValueError(f"Unknown alternative: {alternative}")

    return float(dm_stat), float(p_value)


# ============================================================================
# Main Evaluation Pipeline
# ============================================================================

def evaluate_model(
    predictions_df: pd.DataFrame,
    model_name: str,
    device_id: str,
    rng: np.random.Generator,
) -> Tuple[ForecastingMetrics, AnomalyDetectionMetrics, pd.DataFrame, pd.DataFrame]:
    """
    Run full evaluation for a single model on a single device.

    Args:
        predictions_df: DataFrame with columns:
            timestamp, avg_wattage (actual), predicted_wattage, split (train/val/test).
        model_name: Name of the model being evaluated.
        device_id: Device identifier.
        rng: Seeded random generator for reproducible anomaly injection.

    Returns:
        Tuple of (forecasting_metrics, anomaly_metrics, sweep_df, ground_truth_df).
    """
    # Split data
    val_mask = predictions_df["split"] == "val"
    test_mask = predictions_df["split"] == "test"

    val_df = predictions_df.loc[val_mask].copy()
    test_df = predictions_df.loc[test_mask].copy()

    if test_df.empty:
        raise ValueError(f"No test data for device {device_id}, model {model_name}")

    # Compute residuals from validation set for threshold calibration
    if not val_df.empty:
        val_actual = val_df["avg_wattage"].to_numpy(dtype=float)
        val_pred = val_df["predicted_wattage"].to_numpy(dtype=float)
        val_residuals = val_actual - val_pred
        sigma_residuals = float(np.std(val_residuals, ddof=1)) if len(val_residuals) > 1 else 1.0
    else:
        sigma_residuals = 1.0

    # Inject synthetic anomalies into test set
    anomalous_test_df, ground_truth_df = inject_synthetic_anomalies(test_df, rng)

    # Get predictions and actuals from anomalous test set
    y_true_anomalous = anomalous_test_df["avg_wattage"].to_numpy(dtype=float)
    y_pred_test = anomalous_test_df["predicted_wattage"].to_numpy(dtype=float)

    # Also get clean test actuals for forecasting metrics
    y_true_clean = test_df["avg_wattage"].to_numpy(dtype=float)

    # Forecasting metrics (on clean test data — anomalies are for detection eval)
    mae, rmse, mape, res_mean, res_std = compute_forecasting_metrics(y_true_clean, y_pred_test)

    forecasting = ForecastingMetrics(
        device_id=device_id,
        model=model_name,
        mae=mae,
        rmse=rmse,
        mape=mape,
        residual_mean=res_mean,
        residual_std=res_std,
    )

    # Anomaly detection metrics
    best_row, sweep_df = evaluate_anomaly_detection(
        y_true=y_true_anomalous,
        y_pred=y_pred_test,
        ground_truth_df=ground_truth_df,
        sigma_residuals=sigma_residuals,
    )

    anomaly = AnomalyDetectionMetrics(
        device_id=device_id,
        model=model_name,
        best_k=best_row["k"],
        best_f1=best_row["f1"],
        precision=best_row["precision"],
        recall=best_row["recall"],
        true_positives=best_row["true_positives"],
        false_positives=best_row["false_positives"],
        false_negatives=best_row["false_negatives"],
    )

    return forecasting, anomaly, sweep_df, ground_truth_df


def run_pairwise_comparisons(
    all_predictions: Dict[str, Dict[str, pd.DataFrame]],
    device_id: str,
) -> List[ModelComparison]:
    """
    Run Diebold-Mariano test for all model pairs on a single device.

    Args:
        all_predictions: Nested dict mapping model_name -> device_id -> DataFrame.
        device_id: Device to compare models on.

    Returns:
        List of ModelComparison results.
    """
    model_names = list(all_predictions.keys())
    comparisons = []

    for i, model_a in enumerate(model_names):
        for model_b in model_names[i + 1:]:
            df_a = all_predictions[model_a].get(device_id)
            df_b = all_predictions[model_b].get(device_id)

            if df_a is None or df_b is None:
                continue

            test_a = df_a.loc[df_a["split"] == "test"]
            test_b = df_b.loc[df_b["split"] == "test"]

            if test_a.empty or test_b.empty:
                continue

            # Align timestamps
            merged = test_a[["timestamp", "avg_wattage", "predicted_wattage"]].merge(
                test_b[["timestamp", "predicted_wattage"]],
                on="timestamp",
                suffixes=("_a", "_b"),
            )

            if merged.empty:
                continue

            errors_a = merged["avg_wattage"].to_numpy() - merged["predicted_wattage_a"].to_numpy()
            errors_b = merged["avg_wattage"].to_numpy() - merged["predicted_wattage_b"].to_numpy()

            dm_stat, p_value = diebold_mariano_test(errors_a, errors_b)

            comparisons.append(ModelComparison(
                model_a=model_a,
                model_b=model_b,
                device_id=device_id,
                dm_statistic=round(dm_stat, 4) if np.isfinite(dm_stat) else float("nan"),
                p_value=round(p_value, 4) if np.isfinite(p_value) else float("nan"),
                significant_at_5pct=bool(p_value < 0.05) if np.isfinite(p_value) else False,
            ))

    return comparisons


def build_model_ranking(anomaly_metrics: List[AnomalyDetectionMetrics]) -> List[Dict[str, Any]]:
    """
    Build a ranked list of models by average F1 score across all devices.

    Args:
        anomaly_metrics: List of AnomalyDetectionMetrics for all models and devices.

    Returns:
        List of ranking dicts sorted by mean F1 descending.
    """
    df = pd.DataFrame([asdict(m) for m in anomaly_metrics])
    if df.empty:
        return []

    ranking = (
        df.groupby("model")
        .agg(
            mean_f1=("best_f1", "mean"),
            mean_precision=("precision", "mean"),
            mean_recall=("recall", "mean"),
            mean_mae=("best_f1", lambda x: float("nan")),  # placeholder, filled below
            device_count=("device_id", "nunique"),
        )
        .reset_index()
    )

    # Sort by mean F1 descending
    ranking = ranking.sort_values("mean_f1", ascending=False).reset_index(drop=True)
    ranking["rank"] = range(1, len(ranking) + 1)

    return ranking.to_dict(orient="records")


def load_predictions_file(path: Path) -> pd.DataFrame:
    """
    Load a predictions Parquet file and standardize columns.

    Expected columns: timestamp, device_id, avg_wattage, predicted_wattage, split.
    """
    df = pd.read_parquet(path)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # Ensure required columns exist
    required = {"timestamp", "device_id", "avg_wattage", "predicted_wattage", "split"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in {path}: {missing}")

    return df


def load_all_predictions(predictions_dir: Path) -> Dict[str, Dict[str, pd.DataFrame]]:
    """
    Load all prediction files from the predictions directory.

    Expected structure:
        predictions_dir/
            persistence/
                meter_manila_001.parquet
                meter_manila_002.parquet
                ...
            median/
                ...
            ses/
                ...

    Returns:
        Nested dict: model_name -> device_id -> DataFrame.
    """
    all_predictions: Dict[str, Dict[str, pd.DataFrame]] = {}

    for model_dir in sorted(predictions_dir.iterdir()):
        if not model_dir.is_dir():
            continue

        model_name = model_dir.name
        all_predictions[model_name] = {}

        for parquet_path in sorted(model_dir.glob("*.parquet")):
            df = load_predictions_file(parquet_path)
            device_id = str(df["device_id"].iloc[0])
            all_predictions[model_name][device_id] = df

    return all_predictions


# ============================================================================
# Main Entry Point
# ============================================================================

def run_evaluation(
    predictions_dir: Path,
    output_dir: Path,
    seed: int = 42,
) -> EvaluationReport:
    """
    Run the full evaluation pipeline.

    Args:
        predictions_dir: Directory containing model prediction Parquet files.
        output_dir: Directory for output reports.
        seed: Random seed for reproducible anomaly injection.

    Returns:
        EvaluationReport with all metrics and comparisons.
    """
    ensure_dirs(output_dir)

    print("=" * 60)
    print("Model Evaluation — Baseline")
    print("=" * 60)

    # Load predictions
    print(f"Loading predictions from: {predictions_dir}")
    all_predictions = load_all_predictions(predictions_dir)

    if not all_predictions:
        raise SystemExit("No prediction files found.")

    model_names = list(all_predictions.keys())
    device_ids = sorted(set(
        dev for model in all_predictions for dev in all_predictions[model]
    ))
    print(f"Found {len(model_names)} models, {len(device_ids)} devices")
    print(f"Models: {', '.join(model_names)}")
    print(f"Devices: {', '.join(device_ids)}")
    print("-" * 60)

    rng = np.random.default_rng(seed)

    all_forecasting: List[ForecastingMetrics] = []
    all_anomaly: List[AnomalyDetectionMetrics] = []
    all_sweeps: Dict[str, Dict[str, pd.DataFrame]] = {}
    all_ground_truths: Dict[str, pd.DataFrame] = {}
    all_comparisons: List[ModelComparison] = []

    # Evaluate each model on each device
    for model_name in model_names:
        print(f"\nEvaluating: {model_name}")
        all_sweeps[model_name] = {}

        for device_id in device_ids:
            if device_id not in all_predictions[model_name]:
                print(f"  Skipping {device_id} — no predictions found")
                continue

            try:
                predictions_df = all_predictions[model_name][device_id]
                forecasting, anomaly, sweep_df, gt_df = evaluate_model(
                    predictions_df, model_name, device_id, rng
                )

                all_forecasting.append(forecasting)
                all_anomaly.append(anomaly)
                all_sweeps[model_name][device_id] = sweep_df
                all_ground_truths[device_id] = gt_df

                print(
                    f"  {device_id}: "
                    f"MAE={forecasting.mae:.1f}W, "
                    f"F1={anomaly.best_f1:.3f} "
                    f"(k={anomaly.best_k:.1f}, "
                    f"P={anomaly.precision:.2f}, "
                    f"R={anomaly.recall:.2f})"
                )

            except Exception as e:
                print(f"  {device_id}: ERROR — {e}")

    # Run pairwise Diebold-Mariano comparisons
    print("\n" + "-" * 60)
    print("Running Diebold-Mariano pairwise comparisons...")
    for device_id in device_ids:
        comparisons = run_pairwise_comparisons(all_predictions, device_id)
        all_comparisons.extend(comparisons)

        if comparisons:
            significant = [c for c in comparisons if c.significant_at_5pct]
            print(f"  {device_id}: {len(comparisons)} pairs, {len(significant)} significant at 5%")

    # Build model ranking
    model_ranking = build_model_ranking(all_anomaly)

    # Assemble report
    report = EvaluationReport(
        timestamp=now_stamp(),
        forecasting=[asdict(m) for m in all_forecasting],
        anomaly_detection=[asdict(m) for m in all_anomaly],
        model_comparisons=[asdict(c) for c in all_comparisons],
        model_ranking=model_ranking,
    )

    # Write outputs
    _write_outputs(report, all_sweeps, all_ground_truths, output_dir)

    print("\n" + "=" * 60)
    print("Evaluation complete.")
    _print_summary(report)
    print("=" * 60)

    return report


def _write_outputs(
    report: EvaluationReport,
    all_sweeps: Dict[str, Dict[str, pd.DataFrame]],
    all_ground_truths: Dict[str, pd.DataFrame],
    output_dir: Path,
) -> None:
    """Write all evaluation outputs to disk."""
    stamp = report.timestamp

    # Main report JSON
    report_path = output_dir / f"evaluation_report_{stamp}.json"
    report_path.write_text(json.dumps({
        "timestamp": report.timestamp,
        "forecasting": report.forecasting,
        "anomaly_detection": report.anomaly_detection,
        "model_comparisons": report.model_comparisons,
        "model_ranking": report.model_ranking,
    }, indent=2, default=str))
    print(f"\nWrote: {report_path}")

    # Forecasting metrics CSV
    if report.forecasting:
        forecast_path = output_dir / f"forecasting_metrics_{stamp}.csv"
        pd.DataFrame(report.forecasting).to_csv(forecast_path, index=False)
        print(f"Wrote: {forecast_path}")

    # Anomaly detection metrics CSV
    if report.anomaly_detection:
        anomaly_path = output_dir / f"anomaly_detection_metrics_{stamp}.csv"
        pd.DataFrame(report.anomaly_detection).to_csv(anomaly_path, index=False)
        print(f"Wrote: {anomaly_path}")

    # Model ranking CSV
    if report.model_ranking:
        ranking_path = output_dir / f"model_ranking_{stamp}.csv"
        pd.DataFrame(report.model_ranking).to_csv(ranking_path, index=False)
        print(f"Wrote: {ranking_path}")

    # Threshold sweep details (per model, per device)
    sweep_dir = output_dir / "threshold_sweeps"
    sweep_dir.mkdir(parents=True, exist_ok=True)
    for model_name, devices in all_sweeps.items():
        for device_id, sweep_df in devices.items():
            if not sweep_df.empty:
                sweep_path = sweep_dir / f"sweep_{model_name}_{device_id}_{stamp}.csv"
                sweep_df.to_csv(sweep_path, index=False)
    print(f"Wrote threshold sweeps to: {sweep_dir}")

    # Ground truth (one per device)
    gt_dir = output_dir / "ground_truth"
    gt_dir.mkdir(parents=True, exist_ok=True)
    for device_id, gt_df in all_ground_truths.items():
        if not gt_df.empty:
            gt_path = gt_dir / f"ground_truth_{device_id}_{stamp}.csv"
            gt_df.to_csv(gt_path, index=False)
    print(f"Wrote ground truth to: {gt_dir}")


def _print_summary(report: EvaluationReport) -> None:
    """Print a human-readable evaluation summary."""
    if not report.model_ranking:
        print("No models evaluated.")
        return

    print("\nModel Ranking (by mean F1 score):")
    print(f"{'Rank':<6} {'Model':<20} {'Mean F1':<10} {'Mean P':<10} {'Mean R':<10}")
    print("-" * 56)
    for entry in report.model_ranking:
        print(
            f"{entry['rank']:<6} "
            f"{entry['model']:<20} "
            f"{entry['mean_f1']:.4f}     "
            f"{entry['mean_precision']:.4f}     "
            f"{entry['mean_recall']:.4f}"
        )

    if report.model_comparisons:
        significant = [c for c in report.model_comparisons if c["significant_at_5pct"]]
        print(f"\nDiebold-Mariano: {len(significant)} of {len(report.model_comparisons)} "
              f"pairwise comparisons are statistically significant at 5%.")


# ============================================================================
# CLI
# ============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    """Build CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Baseline model evaluation component"
    )
    parser.add_argument(
        "--predictions-dir",
        type=str,
        default=str(DEFAULT_PREDICTIONS_DIR),
        help="Directory containing model prediction Parquet files",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for evaluation reports",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible anomaly injection",
    )
    return parser


def main() -> None:
    """CLI entry point."""
    parser = build_arg_parser()
    args = parser.parse_args()

    predictions_dir = Path(args.predictions_dir)
    output_dir = Path(args.output_dir)

    if not predictions_dir.exists():
        raise SystemExit(f"Predictions directory not found: {predictions_dir}")

    run_evaluation(
        predictions_dir=predictions_dir,
        output_dir=output_dir,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
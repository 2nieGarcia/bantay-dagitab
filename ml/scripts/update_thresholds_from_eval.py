from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Dict, Tuple

import pandas as pd
import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SWEEP_DIR = PROJECT_ROOT / "output" / "reports" / "threshold_sweeps"
DEFAULT_CONFIG = PROJECT_ROOT / "config" / "deployment.yaml"


def find_latest_stamp(sweep_dir: Path, model: str) -> str:
    pattern = re.compile(rf"^sweep_{model}_.+_(\d{{8}}_\d{{6}})\.csv$")
    stamps = []
    for path in sweep_dir.glob(f"sweep_{model}_*.csv"):
        match = pattern.match(path.name)
        if match:
            stamps.append(match.group(1))
    if not stamps:
        raise SystemExit(f"No sweep files found for model '{model}' in {sweep_dir}")
    return sorted(stamps)[-1]


def parse_device_id(filename: str, model: str, stamp: str) -> str:
    prefix = f"sweep_{model}_"
    suffix = f"_{stamp}.csv"
    if not (filename.startswith(prefix) and filename.endswith(suffix)):
        raise ValueError(f"Unexpected sweep filename: {filename}")
    return filename[len(prefix) : -len(suffix)]


def best_thresholds_from_sweep(path: Path) -> Tuple[float, float]:
    df = pd.read_csv(path)
    if df.empty or "f1" not in df.columns:
        raise ValueError(f"No F1 values in sweep file: {path}")
    best_row = df.loc[df["f1"].idxmax()]
    return float(best_row["k"]), float(best_row["sigma_residuals"])


def update_config_thresholds(
    config_path: Path,
    thresholds: Dict[str, Dict[str, float]],
    default_k: float,
    default_sigma: float,
) -> None:
    config = yaml.safe_load(config_path.read_text())
    anomaly = config.setdefault("anomaly", {})
    anomaly_thresholds = anomaly.setdefault("thresholds", {})

    anomaly_thresholds["default"] = {
        "k": round(default_k, 2),
        "sigma_residuals": round(default_sigma, 2),
    }
    for device_id, values in thresholds.items():
        anomaly_thresholds[device_id] = {
            "k": round(values["k"], 2),
            "sigma_residuals": round(values["sigma_residuals"], 2),
        }

    config_path.write_text(yaml.safe_dump(config, sort_keys=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Update deployment thresholds from eval sweeps")
    parser.add_argument(
        "--sweep-dir",
        type=str,
        default=str(DEFAULT_SWEEP_DIR),
        help="Directory containing threshold sweep CSVs",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="lightgbm",
        help="Model name used in sweep filenames",
    )
    parser.add_argument(
        "--stamp",
        type=str,
        default=None,
        help="Timestamp suffix to select (e.g. 20260526_100552)",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=str(DEFAULT_CONFIG),
        help="Path to deployment.yaml",
    )
    parser.add_argument(
        "--k-scale",
        type=float,
        default=1.0,
        help="Scale factor applied to k for alert volume tuning",
    )

    args = parser.parse_args()
    sweep_dir = Path(args.sweep_dir)
    if not sweep_dir.exists():
        raise SystemExit(f"Sweep directory not found: {sweep_dir}")

    stamp = args.stamp or find_latest_stamp(sweep_dir, args.model)

    thresholds: Dict[str, Dict[str, float]] = {}
    for path in sweep_dir.glob(f"sweep_{args.model}_*_{stamp}.csv"):
        device_id = parse_device_id(path.name, args.model, stamp)
        k, sigma = best_thresholds_from_sweep(path)
        thresholds[device_id] = {
            "k": k * float(args.k_scale),
            "sigma_residuals": sigma,
        }

    if not thresholds:
        raise SystemExit(f"No sweep files matched stamp {stamp}")

    ks = [values["k"] for values in thresholds.values()]
    sigmas = [values["sigma_residuals"] for values in thresholds.values()]
    default_k = float(pd.Series(ks).median())
    default_sigma = float(pd.Series(sigmas).median())

    update_config_thresholds(Path(args.config), thresholds, default_k, default_sigma)
    print(f"Updated thresholds in {args.config} using stamp {stamp}")


if __name__ == "__main__":
    main()

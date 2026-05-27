from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List

import pandas as pd
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CLEAN_DIR = PROJECT_ROOT / "data" / "clean"
FEATURES_DIR = PROJECT_ROOT / "data" / "features"


def ensure_dirs() -> None:
    FEATURES_DIR.mkdir(parents=True, exist_ok=True)


def load_device_frames(device_dir: Path) -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    for parquet_path in sorted(device_dir.glob("*.parquet")):
        df = pd.read_parquet(parquet_path)
        if df.empty:
            continue
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        frames.append(df)

    if not frames:
        return pd.DataFrame()

    full = pd.concat(frames, ignore_index=True)
    return full.sort_values("timestamp").reset_index(drop=True)


def compute_hour_median(df: pd.DataFrame) -> Dict[int, float]:
    if df.empty:
        return {}
    return df.groupby(df["timestamp"].dt.hour)["avg_wattage"].median().to_dict()


def add_features(df: pd.DataFrame, hour_median: Dict[int, float], advanced_lite: bool) -> pd.DataFrame:
    df = df.sort_values("timestamp").reset_index(drop=True)

    df["lag_1"] = df["avg_wattage"].shift(1)
    df["lag_2"] = df["avg_wattage"].shift(2)
    df["lag_4"] = df["avg_wattage"].shift(4)
    df["lag_96"] = df["avg_wattage"].shift(96)

    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    df["rolling_mean_4"] = df["avg_wattage"].rolling(window=4, min_periods=4).mean()
    df["rolling_std_4"] = df["avg_wattage"].rolling(window=4, min_periods=4).std()

    df["hour_median"] = df["hour"].map(hour_median)

    if advanced_lite:
        df["rolling_mean_24h"] = df["avg_wattage"].rolling(window=96, min_periods=96).mean()
        df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24.0)
        df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24.0)
        df["day_of_week_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7.0)
        df["day_of_week_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7.0)

    return df


def write_device_outputs(device_id: str, df: pd.DataFrame) -> List[Path]:
    outputs: List[Path] = []
    device_dir = FEATURES_DIR / device_id
    device_dir.mkdir(parents=True, exist_ok=True)

    month_key = df["timestamp"].dt.tz_convert("UTC").dt.strftime("%Y-%m")
    for month_str, month_df in df.groupby(month_key):
        out_path = device_dir / f"{month_str}.parquet"
        month_df.to_parquet(out_path, index=False, compression="snappy")
        outputs.append(out_path)

    return outputs


def process_device(device_dir: Path, advanced_lite: bool) -> List[Path]:
    device_id = device_dir.name
    full = load_device_frames(device_dir)
    if full.empty:
        return []

    hour_median = compute_hour_median(full)
    features_df = add_features(full, hour_median, advanced_lite)
    return write_device_outputs(device_id, features_df)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Baseline feature engineering component")
    parser.add_argument(
        "--source-dir",
        default=str(CLEAN_DIR),
        help="Directory containing cleaned per-device parquet files",
    )
    parser.add_argument(
        "--advanced-lite",
        action="store_true",
        help="Add rolling_mean_24h and cyclical time encodings",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        raise SystemExit(f"Source directory not found: {source_dir}")

    ensure_dirs()

    device_dirs = [p for p in sorted(source_dir.iterdir()) if p.is_dir()]
    if not device_dirs:
        print("No device folders found.")
        return

    outputs: List[Path] = []
    for device_dir in device_dirs:
        outputs.extend(process_device(device_dir, args.advanced_lite))

    if not outputs:
        print("No data to process.")
        return

    for out in outputs:
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()

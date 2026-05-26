from __future__ import annotations

import argparse
from pathlib import Path
from typing import List

import pandas as pd
import joblib


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FEATURES_DIR = PROJECT_ROOT / "data" / "features"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "models" / "deployed" / "model.joblib"


def _load_features(features_dir: Path) -> pd.DataFrame:
    frames: List[pd.DataFrame] = []
    for device_dir in sorted(features_dir.iterdir()):
        if not device_dir.is_dir():
            continue
        for parquet_path in sorted(device_dir.glob("*.parquet")):
            df = pd.read_parquet(parquet_path)
            if df.empty:
                continue
            frames.append(df)

    if not frames:
        return pd.DataFrame()

    full = pd.concat(frames, ignore_index=True)
    return full


def _select_feature_cols(df: pd.DataFrame) -> List[str]:
    excluded_cols = {
        "timestamp",
        "avg_wattage",
        "device_id",
        "user_account_id",
        "data_quality_flag",
        "date",
        "split",
        "ingestion_time",
    }
    return [
        col
        for col in df.columns
        if col not in excluded_cols
        and (pd.api.types.is_numeric_dtype(df[col]) or pd.api.types.is_bool_dtype(df[col]))
    ]


def train_lightgbm_model(features_dir: Path) -> dict:
    try:
        import lightgbm as lgb
    except ImportError as exc:
        raise SystemExit("lightgbm is not installed in this environment") from exc

    df = _load_features(features_dir)
    if df.empty:
        raise SystemExit(f"No feature data found in: {features_dir}")

    feature_cols = _select_feature_cols(df)
    if not feature_cols:
        raise SystemExit("No numeric feature columns found.")

    df = df.dropna(subset=feature_cols + ["avg_wattage"]).copy()
    if df.empty:
        raise SystemExit("No rows left after dropping NaNs.")

    model = lgb.LGBMRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        random_state=42,
    )
    model.fit(df[feature_cols], df["avg_wattage"])

    return {
        "model": model,
        "feature_cols": feature_cols,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and save deployment model")
    parser.add_argument(
        "--features-dir",
        type=str,
        default=str(DEFAULT_FEATURES_DIR),
        help="Directory containing per-device feature parquet files",
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path to save model artifact",
    )

    args = parser.parse_args()
    features_dir = Path(args.features_dir)
    if not features_dir.exists():
        raise SystemExit(f"Features directory not found: {features_dir}")

    payload = train_lightgbm_model(features_dir)

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, output_path)
    print(f"Saved model to: {output_path}")


def save_model(model_path: str, target_path: str) -> None:
    """Copy a model artifact to a target path."""
    src = Path(model_path)
    dst = Path(target_path)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(src.read_bytes())


if __name__ == "__main__":
    main()

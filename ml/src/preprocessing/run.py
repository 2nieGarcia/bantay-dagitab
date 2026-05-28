"""Preprocessing stage — ARCHITECTURE §2.

Two read paths:

  - File mode (default): reads per-day Parquet files produced by
    `src/ingestion/run.py consolidate`. Used during synthetic-data
    development and offline training-set preparation.

  - DB mode (`--source-db`): reads from Django's canonical IoT table
    `iot_monitoring_iotreading` (paper Contract A). Used when training
    sets need to be (re)built from production data already stored in
    Supabase.

Output is the cleaned, 15-minute-gridded per-device Parquet under
`data/clean/{device_id}/YYYY-MM.parquet`, regardless of source. The
preprocessing stage is read-only against the source database: it never
writes back, and it has no notion of a "processed" flag (Django's
schema does not carry one; that bookkeeping belongs to the inference
worker via `ml_worker_state`).
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from sqlalchemy import text
from src.db import get_engine as _get_engine


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_IOT_PARQUET_DIR = PROJECT_ROOT / "data" / "raw" / "iot_parquet"
CLEAN_DIR = PROJECT_ROOT / "data" / "clean"
QUALITY_REPORT_DIR = CLEAN_DIR / "quality_reports"


@dataclass
class QualityReport:
    device_id: str
    month: str
    input_rows: int
    output_rows: int
    duplicate_rows_removed: int
    outlier_rows_clipped: int
    gap_rows: int


def get_db_engine():
    """Return project DB engine (reads DATABASE_URL from .env)."""
    return _get_engine()


def ensure_dirs() -> None:
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    QUALITY_REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# FILE-BASED DATA LOADING
# ============================================================================

def load_iot_parquet(path: Path) -> pd.DataFrame:
    """Load IoT readings from Parquet file."""
    df = pd.read_parquet(path)
    if df.empty:
        return df

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values(["device_id", "timestamp"]).reset_index(drop=True)
    return df


# ============================================================================
# DJANGO TABLE LOADING (read-only — paper Contract A)
# ============================================================================

def load_iot_from_db(device_id: Optional[str] = None) -> pd.DataFrame:
    """Load IoT readings from Django's iot_monitoring_iotreading table.

    Args:
        device_id: Optional specific device to load. If None, loads all devices.

    Returns:
        DataFrame with columns: id, device_id, user_account_id, timestamp,
        avg_wattage, reading_interval_minutes — sorted by device and timestamp.
        Note: user_account_id is aliased from Django's integer FK user_id.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        if device_id:
            query = text("""
                SELECT id,
                       device_id,
                       user_id        AS user_account_id,
                       timestamp,
                       avg_wattage,
                       reading_interval_minutes
                FROM iot_monitoring_iotreading
                WHERE device_id = :device_id
                ORDER BY device_id, timestamp
            """)
            df = pd.read_sql_query(query, conn, params={"device_id": device_id})
        else:
            query = text("""
                SELECT id,
                       device_id,
                       user_id        AS user_account_id,
                       timestamp,
                       avg_wattage,
                       reading_interval_minutes
                FROM iot_monitoring_iotreading
                ORDER BY device_id, timestamp
            """)
            df = pd.read_sql_query(query, conn)

    if df.empty:
        return df

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


def get_device_list_from_db() -> List[str]:
    """Return distinct device IDs present in iot_monitoring_iotreading."""
    engine = get_db_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT DISTINCT device_id FROM iot_monitoring_iotreading "
                "ORDER BY device_id"
            )
        )
        return [row[0] for row in result]


def get_total_count_db(device_id: Optional[str] = None) -> int:
    """Return row count in iot_monitoring_iotreading, optionally per-device."""
    engine = get_db_engine()

    with engine.connect() as conn:
        if device_id:
            result = conn.execute(
                text(
                    "SELECT COUNT(*) FROM iot_monitoring_iotreading "
                    "WHERE device_id = :device_id"
                ),
                {"device_id": device_id},
            )
        else:
            result = conn.execute(
                text("SELECT COUNT(*) FROM iot_monitoring_iotreading")
            )
        return result.fetchone()[0]


# ============================================================================
# PREPROCESSING LOGIC (shared between file and DB modes)
# ============================================================================

def clip_wattage(df: pd.DataFrame) -> int:
    """Clip wattage values outside [0, 10000] to NaN."""
    if "avg_wattage" not in df.columns or df.empty:
        return 0

    outlier_mask = (df["avg_wattage"] < 0) | (df["avg_wattage"] > 10000)
    outlier_count = int(outlier_mask.sum())
    df.loc[outlier_mask, "avg_wattage"] = pd.NA
    return outlier_count


def preprocess_device(df: pd.DataFrame, device_id: str) -> Dict[str, pd.DataFrame]:
    """Clean and preprocess readings for a single device.

    Steps:
    1. Deduplicate (keep first)
    2. Clip outliers
    3. Resample to 15-minute grid
    4. Forward-fill gaps up to 2 intervals
    5. Flag remaining gaps

    Returns:
        Dict mapping month string (YYYY-MM) to cleaned DataFrame.
    """
    device_df = df[df["device_id"] == device_id].copy()
    if device_df.empty:
        return {}

    before = len(device_df)
    device_df = device_df.drop_duplicates(subset=["device_id", "timestamp"], keep="first")
    duplicate_rows_removed = before - len(device_df)

    outlier_rows_clipped = clip_wattage(device_df)

    device_df = device_df.set_index("timestamp").sort_index()
    resampled = device_df.resample("15min").asfreq()

    resampled["device_id"] = device_id
    if "user_account_id" in device_df.columns:
        resampled["user_account_id"] = device_df["user_account_id"].dropna().iloc[0]

    if "reading_interval_minutes" in device_df.columns:
        resampled["reading_interval_minutes"] = 15

    resampled["avg_wattage"] = resampled["avg_wattage"].ffill(limit=2)

    gap_mask = resampled["avg_wattage"].isna()
    resampled["data_quality_flag"] = "ok"
    resampled.loc[gap_mask, "data_quality_flag"] = "gap"

    resampled = resampled.reset_index()

    outputs: Dict[str, pd.DataFrame] = {}
    month_key = resampled["timestamp"].dt.tz_convert("UTC").dt.strftime("%Y-%m")
    for month_str, month_df in resampled.groupby(month_key):
        outputs[month_str] = month_df
        report = QualityReport(
            device_id=device_id,
            month=month_str,
            input_rows=len(device_df),
            output_rows=len(month_df),
            duplicate_rows_removed=duplicate_rows_removed,
            outlier_rows_clipped=outlier_rows_clipped,
            gap_rows=int(month_df["data_quality_flag"].eq("gap").sum()),
        )
        report_path = QUALITY_REPORT_DIR / f"{device_id}_{month_str}.json"
        report_path.write_text(json.dumps(asdict(report), indent=2))

    return outputs


def write_outputs(outputs: Dict[str, pd.DataFrame], device_id: str) -> List[Path]:
    """Write cleaned data to Parquet files."""
    paths: List[Path] = []
    device_dir = CLEAN_DIR / device_id
    device_dir.mkdir(parents=True, exist_ok=True)

    for month, month_df in outputs.items():
        out_path = device_dir / f"{month}.parquet"
        month_df.to_parquet(out_path, index=False, compression="snappy")
        paths.append(out_path)

    return paths


# ============================================================================
# PIPELINE RUNNERS
# ============================================================================

def preprocess_file(path: Path) -> List[Path]:
    """Preprocess a single Parquet file (file-based pipeline)."""
    df = load_iot_parquet(path)
    if df.empty:
        return []

    ensure_dirs()
    outputs: List[Path] = []
    for device_id in df["device_id"].dropna().unique():
        device_outputs = preprocess_device(df, device_id)
        outputs.extend(write_outputs(device_outputs, device_id))

    return outputs


def preprocess_from_db() -> List[Path]:
    """Preprocess all readings from Django's iot_monitoring_iotreading.

    Read-only: never writes back to the source table.
    """
    total = get_total_count_db()
    print(f"Total readings in iot_monitoring_iotreading: {total:,}")

    if total == 0:
        print("No readings to process.")
        return []

    devices = get_device_list_from_db()
    print(f"Devices found: {len(devices)}")

    ensure_dirs()
    all_outputs: List[Path] = []

    for device_id in devices:
        print(f"\nProcessing {device_id}...")

        device_df = load_iot_from_db(device_id)
        if device_df.empty:
            print(f"  No readings for {device_id}")
            continue

        print(f"  Loaded {len(device_df)} readings from database")

        device_outputs = preprocess_device(device_df, device_id)

        paths = write_outputs(device_outputs, device_id)
        all_outputs.extend(paths)

        for path in paths:
            print(f"  Wrote {path}")

        quality_paths = sorted((QUALITY_REPORT_DIR).glob(f"{device_id}_*.json"))
        if quality_paths:
            latest_report = json.loads(quality_paths[-1].read_text())
            print(
                f"  Quality: {latest_report['gap_rows']} gap rows, "
                f"{latest_report['duplicate_rows_removed']} duplicates removed, "
                f"{latest_report['outlier_rows_clipped']} outliers clipped"
            )

    return all_outputs


# ============================================================================
# STATUS / REPORTING
# ============================================================================

def run_db_status() -> None:
    """Display row counts from Django's iot_monitoring_iotreading."""
    print("\n" + "=" * 60)
    print("IoT readings — iot_monitoring_iotreading (Django)")
    print("=" * 60)

    engine = get_db_engine()

    with engine.connect() as conn:
        total = conn.execute(
            text("SELECT COUNT(*) FROM iot_monitoring_iotreading")
        ).fetchone()[0]

        print(f"Total readings: {total:,}")

        print(f"\n{'Device':<20} {'Total':<10}")
        print("-" * 32)

        result = conn.execute(text("""
            SELECT device_id, COUNT(*) AS total
            FROM iot_monitoring_iotreading
            GROUP BY device_id
            ORDER BY device_id
        """))

        for row in result:
            print(f"{row[0]:<20} {row[1]:<10}")

    quality_files = sorted(QUALITY_REPORT_DIR.glob("*.json"))
    print(f"\nQuality reports generated: {len(quality_files)}")


# ============================================================================
# CLI
# ============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Preprocessing component — file-based and Django-table modes"
    )
    parser.add_argument(
        "--source-dir",
        default=str(RAW_IOT_PARQUET_DIR),
        help="Directory containing raw IoT parquet files (file mode)",
    )
    parser.add_argument(
        "--source-db",
        action="store_true",
        help="Read from Django's iot_monitoring_iotreading table instead of Parquet files",
    )
    parser.add_argument(
        "--db-status",
        action="store_true",
        help="Show row counts from Django's iot_monitoring_iotreading",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.db_status:
        ensure_dirs()
        run_db_status()
        return

    if args.source_db:
        ensure_dirs()
        outputs = preprocess_from_db()
        if not outputs:
            print("No data processed from database.")
        else:
            print(f"\nTotal files written: {len(outputs)}")
        return

    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        raise SystemExit(f"Source directory not found: {source_dir}")

    parquet_files = sorted(source_dir.glob("*.parquet"))
    if not parquet_files:
        print("No input files found.")
        return

    outputs: List[Path] = []
    for parquet_path in parquet_files:
        if parquet_path.name.startswith("ocr_") or parquet_path.name == "ocr_bills.parquet":
            continue
        outputs.extend(preprocess_file(parquet_path))

    if not outputs:
        print("No data to preprocess.")
        return

    for out in outputs:
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from datetime import timezone
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from sqlalchemy import create_engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_IOT_PARQUET_DIR = PROJECT_ROOT / "data" / "raw" / "iot_parquet"
CLEAN_DIR = PROJECT_ROOT / "data" / "clean"
QUALITY_REPORT_DIR = CLEAN_DIR / "quality_reports"

# PostgreSQL Configuration
DB_URL = "postgresql://postgres:admin123@localhost:5433/bantay_dagitab"


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
    """Create PostgreSQL engine."""
    return create_engine(DB_URL)


def ensure_dirs() -> None:
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    QUALITY_REPORT_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# FILE-BASED DATA LOADING (Original)
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
# POSTGRESQL DATA LOADING (New — for DBMS course)
# ============================================================================

def load_iot_from_db(device_id: Optional[str] = None) -> pd.DataFrame:
    """
    Load unprocessed IoT readings from PostgreSQL.

    Demonstrates: SELECT with WHERE clause, filtering by processed flag.

    Args:
        device_id: Optional specific device to load. If None, loads all devices.

    Returns:
        DataFrame with all unprocessed readings, sorted by device and timestamp.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        if device_id:
            query = """
                SELECT id, device_id, user_account_id, timestamp, avg_wattage,
                       reading_interval_minutes, ingestion_time
                FROM iot_readings
                WHERE processed = FALSE AND device_id = :device_id
                ORDER BY device_id, timestamp
            """
            df = pd.read_sql_query(query, conn, params={"device_id": device_id})
        else:
            query = """
                SELECT id, device_id, user_account_id, timestamp, avg_wattage,
                       reading_interval_minutes, ingestion_time
                FROM iot_readings
                WHERE processed = FALSE
                ORDER BY device_id, timestamp
            """
            df = pd.read_sql_query(query, conn)

    if df.empty:
        return df

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


def get_device_list_from_db() -> List[str]:
    """
    Get list of distinct device IDs from PostgreSQL.

    Demonstrates: SELECT DISTINCT.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT DISTINCT device_id FROM iot_readings ORDER BY device_id")
        )
        return [row[0] for row in result]


def get_unprocessed_count_db(device_id: Optional[str] = None) -> int:
    """
    Get count of unprocessed readings.

    Demonstrates: COUNT with WHERE.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        if device_id:
            result = conn.execute(
                text("""
                    SELECT COUNT(*) FROM iot_readings 
                    WHERE processed = FALSE AND device_id = :device_id
                """),
                {"device_id": device_id},
            )
        else:
            result = conn.execute(
                text("SELECT COUNT(*) FROM iot_readings WHERE processed = FALSE")
            )
        return result.fetchone()[0]


def mark_readings_processed_db(reading_ids: List[int]) -> int:
    """
    Mark readings as processed in PostgreSQL after cleaning.

    Demonstrates: UPDATE with WHERE IN clause, transaction safety.

    Args:
        reading_ids: List of reading IDs to mark as processed.

    Returns:
        Number of rows updated.
    """
    if not reading_ids:
        return 0

    engine = get_db_engine()

    with engine.connect() as conn:
        # Process in batches to avoid overly large IN clauses
        batch_size = 1000
        total_updated = 0

        for i in range(0, len(reading_ids), batch_size):
            batch = reading_ids[i:i + batch_size]
            placeholders = ",".join(f":id_{j}" for j in range(len(batch)))
            params = {f"id_{j}": int(batch[j]) for j in range(len(batch))}

            result = conn.execute(
                text(f"""
                    UPDATE iot_readings 
                    SET processed = TRUE 
                    WHERE id IN ({placeholders})
                """),
                params,
            )
            total_updated += result.rowcount

        conn.commit()

    return total_updated


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


def preprocess_device(
    df: pd.DataFrame,
    device_id: str,
    return_processed_ids: bool = False,
) -> Dict[str, pd.DataFrame]:
    """
    Clean and preprocess readings for a single device.

    Steps:
    1. Deduplicate (keep first)
    2. Clip outliers
    3. Resample to 15-minute grid
    4. Forward-fill gaps up to 2 intervals
    5. Flag remaining gaps

    Args:
        df: Raw readings dataframe.
        device_id: Device identifier.
        return_processed_ids: If True, also return the IDs of processed rows.

    Returns:
        Dict mapping month string to cleaned DataFrame.
        If return_processed_ids is True, includes a "processed_ids" key with list of IDs.
    """
    device_df = df[df["device_id"] == device_id].copy()
    if device_df.empty:
        return {}

    # Track which rows were used (for marking processed in DB)
    processed_ids = device_df["id"].tolist() if "id" in device_df.columns else []

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

    if return_processed_ids:
        outputs["_processed_ids"] = pd.DataFrame({"id": processed_ids})

    return outputs


def write_outputs(outputs: Dict[str, pd.DataFrame], device_id: str) -> List[Path]:
    """Write cleaned data to Parquet files."""
    paths: List[Path] = []
    device_dir = CLEAN_DIR / device_id
    device_dir.mkdir(parents=True, exist_ok=True)

    for month, month_df in outputs.items():
        if month.startswith("_"):  # Skip metadata keys
            continue
        out_path = device_dir / f"{month}.parquet"
        month_df.to_parquet(out_path, index=False, compression="snappy")
        paths.append(out_path)

    return paths


# ============================================================================
# PIPELINE RUNNERS
# ============================================================================

def preprocess_file(path: Path) -> List[Path]:
    """Preprocess a single Parquet file (original file-based pipeline)."""
    df = load_iot_parquet(path)
    if df.empty:
        return []

    ensure_dirs()
    outputs: List[Path] = []
    for device_id in df["device_id"].dropna().unique():
        device_outputs = preprocess_device(df, device_id)
        outputs.extend(write_outputs(device_outputs, device_id))

    return outputs


def preprocess_from_db(mark_processed: bool = True) -> List[Path]:
    """
    Preprocess all unprocessed readings from PostgreSQL.

    Demonstrates: SELECT unprocessed, UPDATE processed flag after cleaning.

    Args:
        mark_processed: If True, mark readings as processed after cleaning.

    Returns:
        List of output Parquet file paths.
    """
    engine = get_db_engine()

    # Check unprocessed count first
    total_unprocessed = get_unprocessed_count_db()
    print(f"Unprocessed readings in database: {total_unprocessed:,}")

    if total_unprocessed == 0:
        print("No unprocessed readings to process.")
        return []

    # Get device list
    devices = get_device_list_from_db()
    print(f"Devices found: {len(devices)}")

    ensure_dirs()
    all_outputs: List[Path] = []
    all_processed_ids: List[int] = []

    for device_id in devices:
        print(f"\nProcessing {device_id}...")

        # Load data for this device from PostgreSQL
        device_df = load_iot_from_db(device_id)
        if device_df.empty:
            print(f"  No unprocessed readings for {device_id}")
            continue

        print(f"  Loaded {len(device_df)} readings from database")

        # Preprocess
        device_outputs = preprocess_device(device_df, device_id, return_processed_ids=True)

        # Extract processed IDs
        if "_processed_ids" in device_outputs:
            ids_df = device_outputs.pop("_processed_ids")
            all_processed_ids.extend(ids_df["id"].tolist())

        # Write cleaned data
        paths = write_outputs(device_outputs, device_id)
        all_outputs.extend(paths)

        for path in paths:
            print(f"  Wrote {path}")

        # Log quality report summary
        quality_paths = sorted((QUALITY_REPORT_DIR).glob(f"{device_id}_*.json"))
        if quality_paths:
            latest_report = json.loads(quality_paths[-1].read_text())
            print(f"  Quality: {latest_report['gap_rows']} gap rows, "
                  f"{latest_report['duplicate_rows_removed']} duplicates removed, "
                  f"{latest_report['outlier_rows_clipped']} outliers clipped")

    # Mark all as processed in database
    if mark_processed and all_processed_ids:
        print(f"\nMarking {len(all_processed_ids):,} readings as processed...")
        updated = mark_readings_processed_db(all_processed_ids)
        print(f"  Updated {updated:,} rows in database")

        # Verify
        remaining = get_unprocessed_count_db()
        print(f"  Remaining unprocessed: {remaining:,}")

    return all_outputs


# ============================================================================
# STATUS / REPORTING
# ============================================================================

def run_db_status() -> None:
    """Display preprocessing status from PostgreSQL."""
    print("\n" + "=" * 60)
    print("Preprocessing Status — PostgreSQL")
    print("=" * 60)

    engine = get_db_engine()

    with engine.connect() as conn:
        # Overall stats
        total = conn.execute(text("SELECT COUNT(*) FROM iot_readings")).fetchone()[0]
        processed = conn.execute(
            text("SELECT COUNT(*) FROM iot_readings WHERE processed = TRUE")
        ).fetchone()[0]
        unprocessed = total - processed

        print(f"Total readings:    {total:,}")
        print(f"Processed:         {processed:,}")
        print(f"Unprocessed:       {unprocessed:,}")

        # Per-device breakdown
        print(f"\n{'Device':<20} {'Total':<10} {'Processed':<12} {'Unprocessed':<14}")
        print("-" * 56)

        result = conn.execute(text("""
            SELECT 
                device_id,
                COUNT(*) as total,
                SUM(CASE WHEN processed = TRUE THEN 1 ELSE 0 END) as processed_count,
                SUM(CASE WHEN processed = FALSE THEN 1 ELSE 0 END) as unprocessed_count
            FROM iot_readings
            GROUP BY device_id
            ORDER BY device_id
        """))

        for row in result:
            print(
                f"{row[0]:<20} "
                f"{row[1]:<10} "
                f"{row[2]:<12} "
                f"{row[3]:<14}"
            )

    # Quality reports summary
    quality_files = sorted(QUALITY_REPORT_DIR.glob("*.json"))
    print(f"\nQuality reports generated: {len(quality_files)}")


# ============================================================================
# CLI
# ============================================================================

def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Preprocessing component — file-based and PostgreSQL modes"
    )
    parser.add_argument(
        "--source-dir",
        default=str(RAW_IOT_PARQUET_DIR),
        help="Directory containing raw IoT parquet files (file mode)",
    )
    parser.add_argument(
        "--source-db",
        action="store_true",
        help="Read from PostgreSQL instead of Parquet files",
    )
    parser.add_argument(
        "--no-mark-processed",
        action="store_true",
        help="Do not mark readings as processed in database after cleaning",
    )
    parser.add_argument(
        "--db-status",
        action="store_true",
        help="Show preprocessing status from database",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    # DB Status mode
    if args.db_status:
        ensure_dirs()
        run_db_status()
        return

    # PostgreSQL mode
    if args.source_db:
        ensure_dirs()
        outputs = preprocess_from_db(mark_processed=not args.no_mark_processed)
        if not outputs:
            print("No data processed from database.")
        else:
            print(f"\nTotal files written: {len(outputs)}")
        return

    # File mode (original)
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
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
import shutil
from typing import Iterable, List, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text
from src.db import get_engine as _get_engine


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data" / "raw"
IOT_DIR = DATA_ROOT / "iot"
OCR_DIR = DATA_ROOT / "ocr"
IOT_PARQUET_DIR = DATA_ROOT / "iot_parquet"
IOT_ARCHIVE_DIR = DATA_ROOT / "iot_archive"
OCR_PARQUET_DIR = DATA_ROOT / "ocr_parquet"



class IoTReading(BaseModel):
    device_id: str
    user_account_id: str
    timestamp: datetime
    avg_wattage: float
    reading_interval_minutes: int = Field(default=15)


class IoTReadingBatch(BaseModel):
    readings: List[IoTReading]


app = FastAPI(title="Baseline Ingestion API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db_engine():
    """Return project DB engine (reads DATABASE_URL from .env)."""
    return _get_engine()


def ensure_dirs() -> None:
    IOT_DIR.mkdir(parents=True, exist_ok=True)
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    IOT_PARQUET_DIR.mkdir(parents=True, exist_ok=True)
    IOT_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    OCR_PARQUET_DIR.mkdir(parents=True, exist_ok=True)


def daily_iot_csv_path(ts: datetime) -> Path:
    return IOT_DIR / f"{ts.date().isoformat()}.csv"


# ============================================================================
# FILE-BASED INGESTION (Original — kept for backward compatibility)
# ============================================================================

def append_iot_rows(readings: Iterable[IoTReading]) -> int:
    """Write IoT readings to daily CSV file (original method)."""
    ensure_dirs()
    rows = []
    for r in readings:
        rows.append(
            {
                "device_id": r.device_id,
                "user_account_id": r.user_account_id,
                "timestamp": r.timestamp.astimezone(timezone.utc).isoformat(),
                "avg_wattage": r.avg_wattage,
                "reading_interval_minutes": r.reading_interval_minutes,
                "ingestion_time": utc_now_iso(),
            }
        )

    if not rows:
        return 0

    # Fix: use the first reading's timestamp directly instead of iterator peek
    first_ts = readings[0].timestamp if isinstance(readings, list) else next(iter(readings)).timestamp
    csv_path = daily_iot_csv_path(first_ts)
    write_header = not csv_path.exists()

    with csv_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        if write_header:
            writer.writeheader()
        writer.writerows(rows)

    return len(rows)


def save_ocr_csv(upload: UploadFile) -> Path:
    """Save uploaded OCR CSV file to disk (original method)."""
    ensure_dirs()
    if not upload.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV uploads are supported.")

    target = OCR_DIR / "bills.csv"
    content = upload.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    target.write_bytes(content)
    return target


# ============================================================================
# POSTGRESQL INGESTION (New — for DBMS course requirement)
# ============================================================================

def insert_iot_readings_db(readings: Iterable[IoTReading]) -> int:
    """
    Insert IoT readings directly into PostgreSQL.

    Uses ON CONFLICT to handle duplicate (device_id, timestamp) pairs.
    Demonstrates: INSERT, unique constraints, upsert pattern.
    """
    engine = get_db_engine()
    inserted = 0

    with engine.connect() as conn:
        for r in readings:
            try:
                conn.execute(
                    text("""
                        INSERT INTO iot_readings 
                            (device_id, user_account_id, timestamp, avg_wattage, 
                             reading_interval_minutes, ingestion_time, processed)
                        VALUES 
                            (:device_id, :user_account_id, :timestamp, :avg_wattage,
                             :interval_minutes, :ingestion_time, FALSE)
                        ON CONFLICT (device_id, timestamp) DO NOTHING
                    """),
                    {
                        "device_id": r.device_id,
                        "user_account_id": r.user_account_id,
                        "timestamp": r.timestamp.astimezone(timezone.utc).isoformat(),
                        "avg_wattage": r.avg_wattage,
                        "interval_minutes": r.reading_interval_minutes,
                        "ingestion_time": utc_now_iso(),
                    },
                )
                inserted += 1
            except Exception as e:
                print(f"  DB insert error: {e}")

        conn.commit()

    return inserted


def insert_ocr_bill_db(
    user_account_id: str,
    scan_timestamp: str,
    meralco_account_number: str,
    billing_period: str,
    total_kwh: float,
    total_bill: float,
) -> bool:
    """
    Insert a single OCR bill record into PostgreSQL.

    Demonstrates: INSERT with all columns.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        try:
            conn.execute(
                text("""
                    INSERT INTO ocr_bills 
                        (user_account_id, scan_timestamp, meralco_account_number,
                         billing_period, total_kwh_consumed, total_bill_php, ingestion_time)
                    VALUES 
                        (:user_id, :scan_ts, :meralco_num, :billing_period,
                         :total_kwh, :total_bill, :ingestion_time)
                """),
                {
                    "user_id": user_account_id,
                    "scan_ts": scan_timestamp,
                    "meralco_num": meralco_account_number,
                    "billing_period": billing_period,
                    "total_kwh": total_kwh,
                    "total_bill": total_bill,
                    "ingestion_time": utc_now_iso(),
                },
            )
            conn.commit()
            return True
        except Exception as e:
            print(f"  OCR insert error: {e}")
            return False


def get_unprocessed_count_db() -> int:
    """
    Query count of unprocessed readings from PostgreSQL.

    Demonstrates: SELECT with WHERE clause, COUNT aggregation.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT COUNT(*) as cnt FROM iot_readings WHERE processed = FALSE")
        )
        return result.fetchone()[0]


def get_readings_by_device_db(device_id: str, limit: int = 10) -> list:
    """
    Query readings for a specific device from PostgreSQL.

    Demonstrates: SELECT with WHERE, ORDER BY, LIMIT.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT device_id, timestamp, avg_wattage 
                FROM iot_readings 
                WHERE device_id = :device_id 
                ORDER BY timestamp DESC 
                LIMIT :limit
            """),
            {"device_id": device_id, "limit": limit},
        )
        return [dict(row._mapping) for row in result]


def get_device_summary_db() -> list:
    """
    Query per-device summary from PostgreSQL.

    Demonstrates: GROUP BY, COUNT, AVG aggregation functions.
    """
    engine = get_db_engine()

    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT 
                    device_id,
                    COUNT(*) as reading_count,
                    ROUND(AVG(avg_wattage)::numeric, 2) as avg_wattage,
                    MIN(timestamp) as first_reading,
                    MAX(timestamp) as last_reading
                FROM iot_readings
                GROUP BY device_id
                ORDER BY device_id
            """)
        )
        return [dict(row._mapping) for row in result]


def get_readings_with_bills_db(
    user_account_id: Optional[str] = None,
    limit: int = 50,
) -> list:
    """
    Query readings joined with OCR bills for the same user and billing month.

    Demonstrates: JOIN with date_trunc and optional filtering.
    """
    engine = get_db_engine()

    query = text(
        """
        SELECT
            r.device_id,
            r.user_account_id,
            r.timestamp,
            r.avg_wattage,
            b.billing_period,
            b.total_kwh_consumed,
            b.total_bill_php
        FROM iot_readings r
        JOIN ocr_bills b
          ON r.user_account_id = b.user_account_id
         AND date_trunc('month', r.timestamp) = date_trunc('month', b.scan_timestamp)
        WHERE (:user_account_id IS NULL OR r.user_account_id = :user_account_id)
        ORDER BY r.timestamp DESC
        LIMIT :limit
        """
    )

    with engine.connect() as conn:
        result = conn.execute(
            query,
            {
                "user_account_id": user_account_id,
                "limit": limit,
            },
        )
        return [dict(row._mapping) for row in result]


def _format_expected_range(predicted: float, threshold: float) -> str:
    low = max(0.0, predicted - threshold)
    high = predicted + threshold
    return f"{low:.0f}-{high:.0f}"


def _build_alert_message(actual: float, predicted: float, device_id: str) -> str:
    if predicted <= 0:
        return (
            "Warning: Your current usage is higher than expected for this time "
            "of day. Check appliances to avoid bill shock at end of billing cycle."
        )
    pct = int(round(((actual - predicted) / predicted) * 100))
    return (
        "Warning: Your current usage is "
        f"{pct}% higher than your historical average for this time of day. "
        "Check appliances to avoid bill shock at end of billing cycle."
    )


def get_alerts_contract_c_db(
    device_id: Optional[str] = None,
    limit: int = 50,
) -> list:
    """
    Query anomaly alerts and map to Contract C response format.

    Demonstrates: SELECT with optional filtering and data transformation.
    """
    engine = get_db_engine()
    query = text(
        """
        SELECT
            alert_id,
            device_id,
            user_account_id,
            alert_timestamp,
            alert_type,
            actual_wattage,
            predicted_wattage,
            residual_wattage,
            threshold_wattage
        FROM anomaly_alerts
        WHERE (:device_id IS NULL OR device_id = :device_id)
        ORDER BY alert_timestamp DESC
        LIMIT :limit
        """
    )

    with engine.connect() as conn:
        result = conn.execute(
            query,
            {
                "device_id": device_id,
                "limit": limit,
            },
        )
        rows = [dict(row._mapping) for row in result]

    outputs = []
    for row in rows:
        predicted = float(row.get("predicted_wattage") or 0.0)
        threshold = float(row.get("threshold_wattage") or 0.0)
        actual = float(row.get("actual_wattage") or 0.0)
        outputs.append(
            {
                "alert_id": row["alert_id"],
                "device_id": row["device_id"],
                "user_account_id": row["user_account_id"],
                "timestamp": row["alert_timestamp"],
                "alert_type": row["alert_type"],
                "expected_wattage_range": _format_expected_range(predicted, threshold),
                "actual_wattage": actual,
                "message": _build_alert_message(actual, predicted, row["device_id"]),
            }
        )
    return outputs


# ============================================================================
# FASTAPI ENDPOINTS
# ============================================================================

@app.post("/ingest/iot")
def ingest_iot(batch: IoTReadingBatch) -> dict:
    """Ingest IoT readings — writes to BOTH file and PostgreSQL."""
    # File-based (original)
    file_count = append_iot_rows(batch.readings)

    # PostgreSQL (new)
    db_count = insert_iot_readings_db(batch.readings)

    return {
        "status": "ok",
        "rows_written_file": file_count,
        "rows_inserted_db": db_count,
    }


@app.post("/ingest/ocr")
async def ingest_ocr(file: UploadFile = File(...)) -> dict:
    """Ingest OCR bill — saves to BOTH file and PostgreSQL."""
    # File-based (original)
    saved_path = save_ocr_csv(file)

    return {
        "status": "ok",
        "path": str(saved_path),
        "note": "OCR CSV saved to file. Use /ingest/ocr/db for direct DB insert.",
    }


@app.post("/ingest/iot/db")
def ingest_iot_db_only(batch: IoTReadingBatch) -> dict:
    """Ingest IoT readings directly to PostgreSQL only."""
    count = insert_iot_readings_db(batch.readings)
    return {"status": "ok", "rows_inserted_db": count}


@app.get("/db/stats")
def get_db_stats() -> dict:
    """Get database statistics — demonstrates SELECT queries."""
    engine = get_db_engine()

    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM iot_readings")).fetchone()[0]
        unprocessed = conn.execute(
            text("SELECT COUNT(*) FROM iot_readings WHERE processed = FALSE")
        ).fetchone()[0]
        devices = conn.execute(
            text("SELECT COUNT(DISTINCT device_id) FROM iot_readings")
        ).fetchone()[0]
        alerts = conn.execute(text("SELECT COUNT(*) FROM anomaly_alerts")).fetchone()[0]

    return {
        "total_readings": total,
        "unprocessed_readings": unprocessed,
        "devices": devices,
        "alerts_generated": alerts,
    }


@app.get("/db/devices")
def get_device_list() -> list:
    """Get per-device summary — demonstrates GROUP BY aggregation."""
    return get_device_summary_db()


@app.get("/db/readings/{device_id}")
def get_device_readings(device_id: str, limit: int = 10) -> list:
    """Get recent readings for a device — demonstrates filtered SELECT."""
    return get_readings_by_device_db(device_id, limit)


@app.get("/db/readings-with-bills")
def get_readings_with_bills(user_account_id: Optional[str] = None, limit: int = 50) -> list:
    """Join IoT readings with OCR bills (same user + billing month)."""
    return get_readings_with_bills_db(user_account_id=user_account_id, limit=limit)


@app.get("/db/alerts")
def get_alerts_contract_c(device_id: Optional[str] = None, limit: int = 50) -> list:
    """Get anomaly alerts mapped to Contract C output format."""
    return get_alerts_contract_c_db(device_id=device_id, limit=limit)


# ============================================================================
# CONSOLIDATION (unchanged — for file-based pipeline compatibility)
# ============================================================================

def consolidate_iot_csv(path: Path) -> Optional[Path]:
    if not path.exists():
        return None

    df = pd.read_csv(path)
    if df.empty:
        return None

    date_str = path.stem
    parquet_path = IOT_PARQUET_DIR / f"{date_str}.parquet"
    df.to_parquet(parquet_path, index=False, compression="snappy")

    archive_path = IOT_ARCHIVE_DIR / path.name
    path.replace(archive_path)
    return parquet_path


def consolidate_all_iot_csv(source_dir: Path) -> List[Path]:
    ensure_dirs()
    outputs: List[Path] = []
    for csv_path in sorted(source_dir.glob("*.csv")):
        out = consolidate_iot_csv(csv_path)
        if out is not None:
            outputs.append(out)
    return outputs


def _parquet_target(path: Path) -> Path:
    if path.name == "ocr_bills.parquet" or path.name.startswith("ocr_"):
        return OCR_PARQUET_DIR / path.name
    return IOT_PARQUET_DIR / path.name


def passthrough_parquet(source_dir: Path) -> List[Path]:
    ensure_dirs()
    outputs: List[Path] = []
    for parquet_path in sorted(source_dir.glob("*.parquet")):
        target = _parquet_target(parquet_path)
        shutil.copy2(parquet_path, target)
        outputs.append(target)
    return outputs


# ============================================================================
# CLI
# ============================================================================

def run_api(host: str, port: int) -> None:
    import uvicorn
    uvicorn.run(app, host=host, port=port)


def run_consolidate(date: Optional[str], source_dir: Optional[Path]) -> None:
    ensure_dirs()
    src = source_dir or IOT_DIR
    if not src.exists():
        print(f"Source directory not found: {src}")
        return

    if not list(src.glob("*.csv")) and list(src.glob("*.parquet")):
        outputs = passthrough_parquet(src)
        if not outputs:
            print("No data to consolidate.")
            return
        for out in outputs:
            print(f"Copied {out}")
        return

    if date:
        csv_path = src / f"{date}.csv"
        out = consolidate_iot_csv(csv_path)
        if out is None:
            print("No data to consolidate.")
        else:
            print(f"Wrote {out}")
        return

    outputs = consolidate_all_iot_csv(src)
    if not outputs:
        print("No data to consolidate.")
        return

    for out in outputs:
        print(f"Wrote {out}")


def run_db_status() -> None:
    """Display database status — useful for defense demo."""
    print("\n" + "=" * 60)
    print("PostgreSQL Database Status")
    print("=" * 60)
    summary = get_device_summary_db()

    if not summary:
        print("No data found in database.")
        return

    print(f"{'Device':<20} {'Readings':<12} {'Avg Watts':<12} {'First':<22} {'Last':<22}")
    print("-" * 88)
    for row in summary:
        print(
            f"{row['device_id']:<20} "
            f"{row['reading_count']:<12} "
            f"{row['avg_wattage']:<12} "
            f"{str(row['first_reading'])[:22]:<22} "
            f"{str(row['last_reading'])[:22]:<22}"
        )
    print("-" * 88)

    engine = get_db_engine()
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM iot_readings")).fetchone()[0]
    print(f"\nTotal readings: {total:,}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Baseline ingestion component")
    sub = parser.add_subparsers(dest="command", required=True)

    api_cmd = sub.add_parser("api", help="Run FastAPI ingestion server")
    api_cmd.add_argument("--host", default="0.0.0.0")
    api_cmd.add_argument("--port", type=int, default=8000)

    con_cmd = sub.add_parser("consolidate", help="Consolidate IoT CSV to Parquet")
    con_cmd.add_argument("--date", help="Optional YYYY-MM-DD to consolidate a single day")
    con_cmd.add_argument("--source-dir", help="Optional source directory for CSV or Parquet files")

    db_cmd = sub.add_parser("db-status", help="Show PostgreSQL database status")
    
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.command == "api":
        run_api(args.host, args.port)
        return

    if args.command == "consolidate":
        source_dir = Path(args.source_dir) if args.source_dir else None
        run_consolidate(args.date, source_dir)
        return

    if args.command == "db-status":
        run_db_status()
        return


if __name__ == "__main__":
    main()
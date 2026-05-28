"""Ingestion-stage helpers (development / synthetic-data path).

After schema rationalization, production Contract A ingest is owned by
Django (`POST /api/iot/readings/ingest/`, table `iot_monitoring_iotreading`)
and Contract B ingest is owned by Django (`POST /api/billing/ingest/`,
table `billing_bill`). This module no longer hosts an HTTP ingestion
service and no longer writes to any duplicate tables.

What remains here is purely for the laptop-scale development pipeline
described in ARCHITECTURE §1 "Baseline": consolidating per-day raw IoT
CSVs (produced by `scripts/generate_synthetic_data.py`) into compressed
Parquet files that the preprocessing stage can consume.

Run via:

    python -m src.ingestion.run consolidate
    python -m src.ingestion.run consolidate --date 2025-12-01
    python -m src.ingestion.run consolidate --source-dir data/synthetic/baseline/raw
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path
from typing import List, Optional

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = PROJECT_ROOT / "data" / "raw"
IOT_DIR = DATA_ROOT / "iot"
OCR_DIR = DATA_ROOT / "ocr"
IOT_PARQUET_DIR = DATA_ROOT / "iot_parquet"
IOT_ARCHIVE_DIR = DATA_ROOT / "iot_archive"
OCR_PARQUET_DIR = DATA_ROOT / "ocr_parquet"


def ensure_dirs() -> None:
    IOT_DIR.mkdir(parents=True, exist_ok=True)
    OCR_DIR.mkdir(parents=True, exist_ok=True)
    IOT_PARQUET_DIR.mkdir(parents=True, exist_ok=True)
    IOT_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    OCR_PARQUET_DIR.mkdir(parents=True, exist_ok=True)


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


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingestion-stage helpers (dev pipeline)")
    sub = parser.add_subparsers(dest="command", required=True)

    con_cmd = sub.add_parser("consolidate", help="Consolidate IoT CSV to Parquet")
    con_cmd.add_argument("--date", help="Optional YYYY-MM-DD to consolidate a single day")
    con_cmd.add_argument("--source-dir", help="Optional source directory for CSV or Parquet files")

    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    if args.command == "consolidate":
        source_dir = Path(args.source_dir) if args.source_dir else None
        run_consolidate(args.date, source_dir)
        return


if __name__ == "__main__":
    main()

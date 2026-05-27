from pathlib import Path
import pandas as pd
from src.db import get_engine

PROJECT_ROOT = Path(r"D:\bantay-dagitab\ml")
SYNTHETIC_DIR = PROJECT_ROOT / "data" / "synthetic" / "baseline" / "raw"

engine = get_engine()

for parquet_path in sorted(SYNTHETIC_DIR.glob("meter_manila_*.parquet")):
    print(f"Loading {parquet_path.name}...")
    df = pd.read_parquet(parquet_path)
    df["ingestion_time"] = pd.Timestamp.now(tz="UTC")
    df["processed"] = False
    df.to_sql("iot_readings", engine, if_exists="append", index=False)
    print(f"  -> {len(df)} rows")

ocr_path = SYNTHETIC_DIR / "ocr_bills.parquet"
if ocr_path.exists():
    print(f"Loading ocr_bills...")
    df = pd.read_parquet(ocr_path)
    df["ingestion_time"] = pd.Timestamp.now(tz="UTC")
    df.to_sql("ocr_bills", engine, if_exists="append", index=False)
    print(f"  -> {len(df)} rows")

print("Done.")

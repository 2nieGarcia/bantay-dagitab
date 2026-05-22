from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd
from sqlalchemy import create_engine, Engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = "postgresql://postgres:admin123@localhost:5433/bantay_dagitab"


def get_engine(db_url: Optional[str] = None) -> Engine:
    url = db_url or DATABASE_URL
    return create_engine(url)


def read_sql(query: str, engine: Optional[Engine] = None) -> pd.DataFrame:
    eng = engine or get_engine()
    with eng.connect() as conn:
        return pd.read_sql_query(query, conn)


def execute_sql(query: str, engine: Optional[Engine] = None) -> None:
    eng = engine or get_engine()
    with eng.connect() as conn:
        conn.execute(text(query))
        conn.commit()

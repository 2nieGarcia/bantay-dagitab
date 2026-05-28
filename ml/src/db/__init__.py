from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, Engine, text


PROJECT_ROOT = Path(__file__).resolve().parents[2]
# Single source of truth for env: <repo_root>/.env (one level above ml/).
# Falls back silently to system env when running inside docker-compose,
# where env_file injects vars directly.
load_dotenv(PROJECT_ROOT.parent / ".env")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres@localhost:5433/bantay_dagitab",
)


_engine: Optional[Engine] = None


def get_engine(db_url: Optional[str] = None) -> Engine:
    global _engine
    url = db_url or DATABASE_URL
    if db_url is not None:
        kwargs = {}
        if url.startswith("postgres"):
            kwargs = {"pool_size": 2, "max_overflow": 0}
        return create_engine(url, **kwargs)
    if _engine is None:
        kwargs = {}
        if url.startswith("postgres"):
            kwargs = {"pool_size": 2, "max_overflow": 0}
        _engine = create_engine(url, **kwargs)
    return _engine



def read_sql(query: str, engine: Optional[Engine] = None) -> pd.DataFrame:
    eng = engine or get_engine()
    with eng.connect() as conn:
        return pd.read_sql_query(query, conn)


def execute_sql(query: str, engine: Optional[Engine] = None) -> None:
    eng = engine or get_engine()
    with eng.connect() as conn:
        conn.execute(text(query))
        conn.commit()

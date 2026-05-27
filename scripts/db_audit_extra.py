"""Follow-up audit: investigate the two anomalies from db_audit.py.
1. CHECK constraints on billing_bill (paper claims two exist).
2. Non-Django tables (iot_readings, anomaly_alerts, ocr_bills, predictions_log, worker_state).
3. Django migration history.
"""
import os
from pathlib import Path
import psycopg2

ENV_PATH = Path(__file__).resolve().parent.parent / "backend" / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.set_session(readonly=True)
cur = conn.cursor()

def show(title, sql):
    print("\n" + "=" * 70); print(title); print("=" * 70)
    cur.execute(sql)
    for r in cur.fetchall():
        print(" ", r)

# 1. CHECK constraints on billing_bill (cast schema explicitly)
show("All constraints on billing_bill", """
    select conname, contype, pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='billing_bill'
    order by contype, conname
""")

# 2. Column types for billing_bill (Decimal vs Float?)
show("billing_bill columns", """
    select column_name, data_type, numeric_precision, numeric_scale, is_nullable
    from information_schema.columns
    where table_schema='public' and table_name='billing_bill'
    order by ordinal_position
""")

# 3. Django migrations applied
show("Django migrations applied (latest 30)", """
    select app, name, applied
    from django_migrations
    order by applied desc
    limit 30
""")

# 4. Non-Django tables — what are they?
for tbl in ["iot_readings", "anomaly_alerts", "ocr_bills", "predictions_log", "worker_state"]:
    show(f"Schema of {tbl}", f"""
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema='public' and table_name='{tbl}'
        order by ordinal_position
    """)
    cur.execute(f"select count(*) from {tbl}")
    print(f"  row count: {cur.fetchone()[0]}")

# 5. Foreign keys on those non-Django tables (do they reference auth_user?)
show("Foreign keys on the non-Django tables", """
    select tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema
    where tc.constraint_type='FOREIGN KEY'
      and tc.table_schema='public'
      and tc.table_name in ('iot_readings','anomaly_alerts','ocr_bills','predictions_log','worker_state')
""")

conn.close()

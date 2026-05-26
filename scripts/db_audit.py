"""One-shot read-only audit of the Supabase DB against the paper claims.

Run: python scripts/db_audit.py
Reads DATABASE_URL from env or from backend/.env.
"""
import os
import sys
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

DB_URL = os.environ.get("DATABASE_URL")
if not DB_URL:
    print("DATABASE_URL not set"); sys.exit(1)

conn = psycopg2.connect(DB_URL)
conn.set_session(readonly=True)
cur = conn.cursor()

def section(name):
    print("\n" + "=" * 70)
    print(name)
    print("=" * 70)

def rows(sql, params=()):
    cur.execute(sql, params)
    return cur.fetchall()

# 0. Server identity
section("Server identity")
for r in rows("select version()"): print(r[0])
for r in rows("select current_database(), current_user"): print(r)

# 1. Tables that should exist
section("Tables in public schema")
ts = rows("""
    select table_name from information_schema.tables
    where table_schema='public' order by table_name
""")
for t in ts: print(" -", t[0])

expected = {
    "auth_user", "users_profile",
    "iot_monitoring_iotreading", "billing_bill",
    "analytics_anomalyalert", "chatbot_chatlog",
}
present = {t[0] for t in ts}
missing_tables = expected - present
print("\nMissing tables vs paper:", sorted(missing_tables) or "(none)")

# 2. Row counts (P2.7 seed-data check)
section("Row counts (P2.7 seed data)")
for tbl in [
    "auth_user", "users_profile",
    "iot_monitoring_iotreading", "billing_bill",
    "analytics_anomalyalert", "chatbot_chatlog",
]:
    if tbl in present:
        n = rows(f"select count(*) from {tbl}")[0][0]
        print(f" {tbl:40s} {n:>10}")
    else:
        print(f" {tbl:40s}  (table missing)")

# 3. Indexes (P2.6)
section("Non-PK indexes on domain tables (P2.6)")
ix = rows("""
    select tablename, indexname, indexdef
    from pg_indexes
    where schemaname='public'
      and tablename in (
        'iot_monitoring_iotreading','analytics_anomalyalert','billing_bill'
      )
    order by tablename, indexname
""")
for tbl, name, ddl in ix:
    print(f" [{tbl}] {name}")
    print(f"    {ddl}")
expected_idx = {
    "idx_iotreading_user_ts", "idx_iotreading_device",
    "idx_anomaly_user_ts", "idx_bill_user_ts",
}
present_idx = {name for _, name, _ in ix}
missing_idx = expected_idx - present_idx
print("\nMissing named indexes vs paper:", sorted(missing_idx) or "(none)")

# 4. Views / materialized views (P2.9)
section("Views & materialized views (P2.9)")
v = rows("""
    select table_name, 'view' as kind from information_schema.views
    where table_schema='public'
    union all
    select matviewname, 'matview' from pg_matviews where schemaname='public'
    order by 1
""")
for name, kind in v: print(f" - [{kind}] {name}")
expected_v = {"vw_user_monthly_consumption", "vw_recent_anomalies", "vw_bill_vs_telemetry"}
present_v = {n for n, _ in v}
missing_v = expected_v - present_v
print("\nMissing views vs paper:", sorted(missing_v) or "(none)")

# 5. Procedures & functions (P2.10)
section("Stored procedures & functions (P2.10)")
fn = rows("""
    select n.nspname, p.proname,
           case p.prokind when 'f' then 'function' when 'p' then 'procedure' else p.prokind::text end
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (p.proname like 'sp\\_%%' or p.proname like 'fn\\_%%')
    order by 1,2
""")
for r in fn: print(" -", r)
expected_fn = {"sp_ingest_iot_reading", "fn_compute_expected_wattage_range", "fn_total_period_kwh"}
present_fn = {r[1] for r in fn}
missing_fn = expected_fn - present_fn
print("\nMissing routines vs paper:", sorted(missing_fn) or "(none)")

# 6. Triggers (P2.11)
section("Triggers (P2.11)")
tr = rows("""
    select event_object_table, trigger_name, action_timing, event_manipulation
    from information_schema.triggers
    where trigger_schema='public'
    order by 1,2
""")
for r in tr: print(" -", r)
expected_tr = {"trg_iotreading_audit", "trg_bill_baseline_refresh", "trg_anomaly_validate"}
present_tr = {r[1] for r in tr}
missing_tr = expected_tr - present_tr
print("\nMissing triggers vs paper:", sorted(missing_tr) or "(none)")

audit_present = any(t[0] == "iot_monitoring_iotreading_audit" for t in ts)
print("Audit table iot_monitoring_iotreading_audit:", "PRESENT" if audit_present else "MISSING")

# 7. CHECK constraints (paper says these exist on billing_bill)
section("CHECK constraints on billing_bill")
cc = rows("""
    select conname, pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    where t.relname='billing_bill' and c.contype='c'
""")
for r in cc: print(" -", r)

# 8. Roles (P2.12)
section("Database roles (P2.12)")
rl = rows("select rolname, rolcanlogin from pg_roles where rolname not like 'pg\\_%%' order by rolname")
for r in rl: print(" -", r)
expected_roles = {"service_account_role", "app_user", "db_admin_role"}
present_roles = {r[0] for r in rl}
missing_roles = expected_roles - present_roles
print("\nMissing paper-named roles:", sorted(missing_roles) or "(none)")

conn.close()
print("\nDone.")

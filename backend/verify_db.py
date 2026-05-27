import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

def verify_db_objects():
    queries = {
        "Composite Indexes": """
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE indexname IN ('idx_iotreading_user_ts', 'idx_iotreading_device', 'idx_anomaly_user_ts', 'idx_bill_user_ts');
        """,
        "Materialized & SQL Views": """
            SELECT matviewname AS viewname FROM pg_matviews WHERE matviewname = 'vw_user_monthly_consumption'
            UNION ALL
            SELECT viewname FROM pg_views WHERE viewname IN ('vw_recent_anomalies', 'vw_bill_vs_telemetry');
        """,
        "Routines & Functions": """
            SELECT proname, proargnames 
            FROM pg_proc 
            WHERE proname IN ('fn_compute_expected_wattage_range', 'sp_ingest_iot_reading', 'fn_total_period_kwh');
        """,
        "Triggers": """
            SELECT tgname 
            FROM pg_trigger 
            WHERE tgname IN ('trg_anomaly_validate', 'trg_iotreading_audit', 'trg_bill_baseline_refresh');
        """,
        "Audit Table": """
            SELECT tablename 
            FROM pg_tables 
            WHERE tablename = 'iot_monitoring_audit';
        """
    }

    print("\n" + "="*50)
    print(" DATABASE REQUIREMENT VERIFICATION REPORT ")
    print("="*50)

    with connection.cursor() as cursor:
        for category, query in queries.items():
            print(f"\n--- {category} ---")
            cursor.execute(query)
            rows = cursor.fetchall()
            if not rows:
                print("  [X] No objects found.")
            for row in rows:
                print(f"  [OK] {row[0]}")
    print("\n" + "="*50 + "\n")

if __name__ == '__main__':
    verify_db_objects()

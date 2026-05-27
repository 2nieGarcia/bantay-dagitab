from django.db import migrations


class Migration(migrations.Migration):
    """
    Make vw_bill_vs_telemetry tolerant of unparseable billing_period strings.
    The OCR pipeline writes 'Unknown' when the billing-period regex fails to
    match; the original view did to_date(b.billing_period, 'Mon YYYY') which
    crashes with `invalid value "Unknown" for "Mon"` and 500s the dashboard.

    Guards the cast with a regex match against the 'Mon YYYY' shape (e.g.
    "Feb 2024") and leaves the join NULL otherwise.
    """

    dependencies = [
        ('iot_monitoring', '0005_remove_duplicate_anomalyalert'),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
            CREATE OR REPLACE VIEW vw_bill_vs_telemetry AS
            SELECT
                b.id AS bill_id,
                b.user_id,
                b.meralco_account_number,
                b.billing_period,
                b.total_kwh_consumed AS billed_kwh,
                b.total_bill_php,
                COALESCE(tm.kwh, 0) AS telemetry_kwh,
                (b.total_kwh_consumed - COALESCE(tm.kwh, 0)) AS kwh_variance
            FROM billing_bill b
            LEFT JOIN vw_user_monthly_consumption tm
                ON b.user_id = tm.user_id
                AND tm.month = CASE
                    WHEN b.billing_period ~ '^[A-Za-z]{3,9} \d{4}$'
                        THEN to_date(b.billing_period, 'Mon YYYY')
                    ELSE NULL
                END;
            """,
            reverse_sql=r"""
            CREATE OR REPLACE VIEW vw_bill_vs_telemetry AS
            SELECT
                b.id AS bill_id,
                b.user_id,
                b.meralco_account_number,
                b.billing_period,
                b.total_kwh_consumed AS billed_kwh,
                b.total_bill_php,
                COALESCE(tm.kwh, 0) AS telemetry_kwh,
                (b.total_kwh_consumed - COALESCE(tm.kwh, 0)) AS kwh_variance
            FROM billing_bill b
            LEFT JOIN vw_user_monthly_consumption tm
                ON b.user_id = tm.user_id
                AND tm.month = to_date(b.billing_period, 'Mon YYYY');
            """,
        ),
    ]

from django.db import migrations


# Recreate vw_recent_anomalies so it carries the new `status` column added
# in analytics/0004_anomalyalert_status. Dependency on the analytics
# migration ensures the column exists before the view references it.

CREATE_VIEW_SQL = """
CREATE OR REPLACE VIEW vw_recent_anomalies AS
SELECT
    a.alert_id,
    a.user_id,
    p.device_id,
    a.timestamp,
    a.alert_type,
    a.expected_wattage_range,
    a.actual_wattage,
    a.message,
    a.status
FROM analytics_anomalyalert a
JOIN users_profile p ON p.user_id = a.user_id
WHERE a.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY a.timestamp DESC;
"""

RESTORE_VIEW_SQL = """
CREATE OR REPLACE VIEW vw_recent_anomalies AS
SELECT
    a.alert_id, a.user_id, p.device_id, a.timestamp,
    a.alert_type, a.expected_wattage_range, a.actual_wattage, a.message
FROM analytics_anomalyalert a
JOIN users_profile p ON p.user_id = a.user_id
WHERE a.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY a.timestamp DESC;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('iot_monitoring', '0006_safe_billing_period_cast'),
        ('analytics', '0004_anomalyalert_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql=CREATE_VIEW_SQL,
            reverse_sql=RESTORE_VIEW_SQL,
        ),
    ]

from django.db import migrations


# Rewrites fn_anomaly_validate to validate ML-emitted alerts against the
# *triggering* IoT reading, not against the latest reading for the device.
#
# The original rule (migration 0003) compared NEW.actual_wattage with the
# most recent reading for NEW.device_id and rejected the alert if the two
# diverged by more than 50 W. That was incompatible with the sustained-3
# worker model documented in paper §IV.C: by the time the worker pushes an
# alert, the simulator (or a live ESP32) has almost always written a
# baseline reading after the spike, and the trigger would reject every
# legitimate alert.
#
# The new rule preserves the §VI.D intent — "reject alerts inconsistent
# with the underlying telemetry" — but matches the alert payload against
# the specific reading it was derived from: same user, same device, same
# timestamp (within a 2-second tolerance to absorb microsecond drift across
# ISO round-trips). If no matching reading exists (e.g., raw operator
# insert from the admin), the alert is accepted; the trigger only fires
# when a real reading exists and disagrees.


REWRITE_FN_SQL = """
CREATE OR REPLACE FUNCTION fn_anomaly_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_match double precision;
BEGIN
    SELECT avg_wattage INTO v_match
    FROM iot_monitoring_iotreading
    WHERE user_id = NEW.user_id
      AND device_id = NEW.device_id
      AND timestamp BETWEEN NEW.timestamp - INTERVAL '2 seconds'
                        AND NEW.timestamp + INTERVAL '2 seconds'
    ORDER BY abs(extract(epoch from (timestamp - NEW.timestamp))) ASC
    LIMIT 1;

    IF v_match IS NOT NULL AND abs(v_match - NEW.actual_wattage) > 1.0 THEN
        RAISE EXCEPTION
        'Anomaly actual_wattage % does not match triggering reading % (user=%, device=%, ts=%)',
        NEW.actual_wattage, v_match, NEW.user_id, NEW.device_id, NEW.timestamp;
    END IF;

    RETURN NEW;
END;
$$;
"""


RESTORE_FN_SQL = """
CREATE OR REPLACE FUNCTION fn_anomaly_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_recent double precision;
BEGIN
    SELECT avg_wattage INTO v_recent
    FROM iot_monitoring_iotreading
    WHERE device_id = NEW.device_id
    ORDER BY timestamp DESC
    LIMIT 1;

    IF v_recent IS NOT NULL AND abs(v_recent - NEW.actual_wattage) > 50 THEN
        RAISE EXCEPTION
        'Anomaly actual_wattage % inconsistent with latest reading %',
        NEW.actual_wattage, v_recent;
    END IF;

    RETURN NEW;
END;
$$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('iot_monitoring', '0007_vw_recent_anomalies_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql=REWRITE_FN_SQL,
            reverse_sql=RESTORE_FN_SQL,
        ),
    ]

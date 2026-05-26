from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('iot_monitoring', '0002_alter_iotreading_timestamp'),
        ('analytics', '0002_alter_anomalyalert_timestamp'),
        ('billing', '0003_bill_decimal_amounts'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- 1. Four Composite B-Tree Indexes
            CREATE INDEX IF NOT EXISTS idx_iotreading_user_ts ON iot_monitoring_iotreading(user_id, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_iotreading_device ON iot_monitoring_iotreading(device_id);
            CREATE INDEX IF NOT EXISTS idx_anomaly_user_ts ON analytics_anomalyalert(user_id, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_bill_user_ts ON billing_bill(user_id, scan_timestamp DESC);

            -- 5. Audit Table Schema
            CREATE TABLE IF NOT EXISTS iot_monitoring_audit (
                audit_id bigserial PRIMARY KEY,
                reading_id bigint NOT NULL,
                timestamp timestamptz NOT NULL,
                device_id varchar(100) NOT NULL,
                wattage double precision NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_audit_reading_id ON iot_monitoring_audit(reading_id);

            -- 2. Three SQL Views
            CREATE MATERIALIZED VIEW IF NOT EXISTS vw_user_monthly_consumption AS
            SELECT
                user_id,
                date_trunc('month', timestamp) AS month,
                SUM(avg_wattage * reading_interval_minutes) / 60.0 / 1000.0 AS kwh
            FROM iot_monitoring_iotreading
            GROUP BY user_id, date_trunc('month', timestamp);

            CREATE UNIQUE INDEX IF NOT EXISTS idx_vw_user_monthly_consumption_user_month ON vw_user_monthly_consumption(user_id, month);

            CREATE OR REPLACE VIEW vw_recent_anomalies AS
            SELECT
                a.id AS alert_id, a.user_id, p.device_id, a.timestamp,
                a.alert_type, a.expected_wattage_range, a.actual_wattage, a.message
            FROM analytics_anomalyalert a
            JOIN users_profile p ON p.user_id = a.user_id
            WHERE a.timestamp >= NOW() - INTERVAL '7 days'
            ORDER BY a.timestamp DESC;

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

            -- 3. Three Routines
            CREATE OR REPLACE FUNCTION fn_compute_expected_wattage_range(
                p_user_id bigint,
                p_hour_of_day integer,
                OUT min_w double precision,
                OUT max_w double precision
            ) LANGUAGE plpgsql AS $$
            DECLARE
                v_avg double precision;
                v_stddev double precision;
            BEGIN
                SELECT
                    COALESCE(AVG(avg_wattage), 0),
                    COALESCE(STDDEV(avg_wattage), 0)
                INTO v_avg, v_stddev
                FROM iot_monitoring_iotreading
                WHERE user_id = p_user_id
                  AND extract(hour from timestamp) = p_hour_of_day;

                min_w := GREATEST(0, v_avg - (2 * v_stddev));
                max_w := v_avg + (2 * v_stddev);
            END;
            $$;

            CREATE OR REPLACE PROCEDURE sp_ingest_iot_reading(
                p_device_id varchar, p_user_id bigint, p_timestamp timestamptz,
                p_avg_wattage double precision, p_interval_minutes integer
            ) LANGUAGE plpgsql AS $$
            DECLARE
                v_min double precision;
                v_max double precision;
            BEGIN
                INSERT INTO iot_monitoring_iotreading
                (user_id, device_id, timestamp, avg_wattage, reading_interval_minutes)
                VALUES
                (p_user_id, p_device_id, p_timestamp, p_avg_wattage, p_interval_minutes);

                SELECT min_w, max_w INTO v_min, v_max
                FROM fn_compute_expected_wattage_range(p_user_id, extract(hour from p_timestamp));

                IF p_avg_wattage > v_max THEN
                    INSERT INTO analytics_anomalyalert
                    (user_id, device_id, timestamp, alert_type,
                     expected_wattage_range, actual_wattage, message)
                    VALUES
                    (p_user_id, p_device_id, p_timestamp, 'HIGH_USAGE_ANOMALY',
                     v_min::text || '-' || v_max::text, p_avg_wattage,
                     'Reading exceeds historical maximum for this hour.');
                END IF;
            END;
            $$;

            CREATE OR REPLACE FUNCTION fn_total_period_kwh(
                p_user_id bigint,
                p_start timestamptz,
                p_end timestamptz
            ) RETURNS numeric LANGUAGE plpgsql AS $$
            DECLARE
                v_total_kwh numeric;
            BEGIN
                SELECT COALESCE(SUM(avg_wattage * reading_interval_minutes) / 60.0 / 1000.0, 0)
                INTO v_total_kwh
                FROM iot_monitoring_iotreading
                WHERE user_id = p_user_id
                  AND timestamp >= p_start
                  AND timestamp <= p_end;

                RETURN v_total_kwh;
            END;
            $$;

            -- 4. Three Triggers
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

            DROP TRIGGER IF EXISTS trg_anomaly_validate ON analytics_anomalyalert;
            CREATE TRIGGER trg_anomaly_validate
            BEFORE INSERT ON analytics_anomalyalert
            FOR EACH ROW EXECUTE FUNCTION fn_anomaly_validate();

            CREATE OR REPLACE FUNCTION fn_audit_iot_reading() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                INSERT INTO iot_monitoring_audit
                (reading_id, timestamp, device_id, wattage)
                VALUES
                (NEW.id, NEW.timestamp, NEW.device_id, NEW.avg_wattage);

                RETURN NEW;
            END;
            $$;

            DROP TRIGGER IF EXISTS trg_iotreading_audit ON iot_monitoring_iotreading;
            CREATE TRIGGER trg_iotreading_audit
            AFTER INSERT ON iot_monitoring_iotreading
            FOR EACH ROW EXECUTE FUNCTION fn_audit_iot_reading();

            CREATE OR REPLACE FUNCTION fn_refresh_monthly_consumption() RETURNS trigger
            LANGUAGE plpgsql AS $$
            BEGIN
                -- Requires a unique index on (user_id, month) on the materialized view
                REFRESH MATERIALIZED VIEW CONCURRENTLY vw_user_monthly_consumption;
                RETURN NEW;
            END;
            $$;

            DROP TRIGGER IF EXISTS trg_bill_baseline_refresh ON billing_bill;
            CREATE TRIGGER trg_bill_baseline_refresh
            AFTER INSERT ON billing_bill
            FOR EACH STATEMENT EXECUTE FUNCTION fn_refresh_monthly_consumption();
            """,
            reverse_sql="""
            DROP TRIGGER IF EXISTS trg_bill_baseline_refresh ON billing_bill;
            DROP FUNCTION IF EXISTS fn_refresh_monthly_consumption();

            DROP TRIGGER IF EXISTS trg_iotreading_audit ON iot_monitoring_iotreading;
            DROP FUNCTION IF EXISTS fn_audit_iot_reading();

            DROP TRIGGER IF EXISTS trg_anomaly_validate ON analytics_anomalyalert;
            DROP FUNCTION IF EXISTS fn_anomaly_validate();

            DROP FUNCTION IF EXISTS fn_total_period_kwh(bigint, timestamptz, timestamptz);
            DROP PROCEDURE IF EXISTS sp_ingest_iot_reading(varchar, bigint, timestamptz, double precision, integer);
            DROP FUNCTION IF EXISTS fn_compute_expected_wattage_range(bigint, integer);

            DROP VIEW IF EXISTS vw_bill_vs_telemetry;
            DROP VIEW IF EXISTS vw_recent_anomalies;
            DROP MATERIALIZED VIEW IF EXISTS vw_user_monthly_consumption;

            DROP TABLE IF EXISTS iot_monitoring_audit;

            DROP INDEX IF EXISTS idx_bill_user_ts;
            DROP INDEX IF EXISTS idx_anomaly_user_ts;
            DROP INDEX IF EXISTS idx_iotreading_device;
            DROP INDEX IF EXISTS idx_iotreading_user_ts;
            """
        )
    ]

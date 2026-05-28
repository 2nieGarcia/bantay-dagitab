-- ML Service — Internal observability tables
--
-- After the Contract A / B / C schema rationalization, the ML service no
-- longer owns ingestion or alert tables. Those live in Django:
--
--   iot_monitoring_iotreading  — Contract A,  owned by backend/iot_monitoring
--   billing_bill               — Contract B,  owned by backend/billing
--   analytics_anomalyalert     — Contract C,  owned by backend/analytics
--
-- The two tables below are the only ones the ML service owns. They exist
-- in the same Supabase database as Django but are namespaced with `ml_`
-- to make ownership obvious.
--
--   ml_predictions_log  — every prediction the inference worker emits,
--                         used by src/monitoring/daily_report.py
--                         (paper §VII.A.5 "predictions log"; ARCHITECTURE §7).
--
--   ml_worker_state     — small key/value store for the inference worker:
--                           last_processed_reading_id  — cursor into
--                             iot_monitoring_iotreading (replaces the old
--                             `processed` boolean on the duplicate table)
--                           consecutive_<device_id>    — per-device sustained
--                             over-threshold counter (paper §IV.C sustained-3
--                             rule)
--
-- Cleanup of the obsolete duplicate tables (run once after migrating; safe
-- if they were never created):
--
--   DROP TABLE IF EXISTS iot_readings    CASCADE;
--   DROP TABLE IF EXISTS ocr_bills       CASCADE;
--   DROP TABLE IF EXISTS anomaly_alerts  CASCADE;
--   DROP TABLE IF EXISTS predictions_log CASCADE;
--   DROP TABLE IF EXISTS worker_state    CASCADE;

CREATE TABLE IF NOT EXISTS ml_predictions_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    actual_wattage DOUBLE PRECISION NOT NULL,
    predicted_wattage DOUBLE PRECISION NOT NULL,
    residual_wattage DOUBLE PRECISION NOT NULL,
    alert_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_worker_state (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_device_ts
    ON ml_predictions_log(device_id, timestamp);

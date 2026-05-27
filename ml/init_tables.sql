CREATE TABLE IF NOT EXISTS iot_readings (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    user_account_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    avg_wattage DOUBLE PRECISION NOT NULL,
    reading_interval_minutes INTEGER DEFAULT 15,
    ingestion_time TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    UNIQUE(device_id, timestamp)
);
CREATE TABLE IF NOT EXISTS ocr_bills (
    id SERIAL PRIMARY KEY,
    user_account_id VARCHAR(50) NOT NULL,
    scan_timestamp TIMESTAMPTZ NOT NULL,
    meralco_account_number VARCHAR(20) NOT NULL,
    billing_period VARCHAR(20) NOT NULL,
    total_kwh_consumed DOUBLE PRECISION NOT NULL,
    total_bill_php DOUBLE PRECISION NOT NULL,
    ingestion_time TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(100) NOT NULL UNIQUE,
    device_id VARCHAR(50) NOT NULL,
    user_account_id VARCHAR(50) NOT NULL,
    alert_timestamp TIMESTAMPTZ NOT NULL,
    alert_type VARCHAR(50) DEFAULT 'SUSTAINED_OVER_CONSUMPTION',
    actual_wattage DOUBLE PRECISION NOT NULL,
    predicted_wattage DOUBLE PRECISION NOT NULL,
    residual_wattage DOUBLE PRECISION NOT NULL,
    threshold_wattage DOUBLE PRECISION NOT NULL,
    k_value DOUBLE PRECISION NOT NULL,
    sigma_residuals DOUBLE PRECISION NOT NULL,
    consecutive_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS predictions_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(50) NOT NULL,
    actual_wattage DOUBLE PRECISION NOT NULL,
    predicted_wattage DOUBLE PRECISION NOT NULL,
    residual_wattage DOUBLE PRECISION NOT NULL,
    alert_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS worker_state (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_iot_device_ts ON iot_readings(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_iot_processed ON iot_readings(processed, ingestion_time);
CREATE INDEX IF NOT EXISTS idx_predictions_device_ts ON predictions_log(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_device_ts ON anomaly_alerts(device_id, alert_timestamp);

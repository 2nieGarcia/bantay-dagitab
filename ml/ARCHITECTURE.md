# ARCHITECTURE.md

## End-to-End Machine Learning Pipeline Architecture

**Project:** Residential Energy Anomaly Detection for Bill Shock Prevention
**Target:** Post-paid MERALCO households, Sampaloc Manila
**Phase:** Research & Development (laptop-scale, production-aware)

---

## Architecture Overview

The pipeline is designed as a modular sequence of independent stages, each with clear input/output contracts. It runs on a single machine (Intel Core i5 laptop) using local storage and lightweight tools, while remaining structurally compatible with containerized, cloud-native deployment later. Every component is motivated by the specific requirements of detecting anomalous energy consumption from 15-minute IoT wattage readings and alerting users before bill shock occurs.

The architecture uses a file-based data lake approach locally (Parquet files) with PostgreSQL as an optional upgrade target. Orchestration is manual during development but structured to map cleanly to workflow schedulers like Airflow or Prefect. The pipeline is stateless between stages, with each stage writing its output to a well-defined location that serves as input to the next stage.

### Core Design Principles

- Start with the simplest credible baseline at every stage; add complexity only when a measurable gap exists.
- Each component is independently testable and replaceable.
- All intermediate outputs are versioned and logged to enable debugging and reproducibility.
- The pipeline can be executed end-to-end with a single script during development but is factored into discrete modules for future orchestration.

---

## Pipeline Components

### 1. Data Ingestion

**Purpose:** Collect raw IoT sensor readings and OCR-extracted billing data from their respective sources and land them into a unified, queryable storage layer. This stage abstracts away source-specific protocols and ensures the rest of the pipeline operates on a stable, local copy of the data.

**Input Sources:**
- IoT device readings (Contract A) arriving via HTTP POST from ESP32 microcontrollers to a lightweight FastAPI receiver.
- OCR billing extracts (Contract B) uploaded manually by users through the dashboard or batch-imported during onboarding.

**Baseline:**
- FastAPI endpoint receives JSON payloads and appends them to a daily CSV file on local disk (`data/raw/iot/YYYY-MM-DD.csv`).
- OCR data is uploaded as CSV via a simple web form and saved to `data/raw/ocr/bills.csv`.
- A scheduled Python script runs hourly to consolidate the daily CSV into a compressed Parquet file and archive the raw CSV.

**Advanced:**
- Replace file-based landing with a local PostgreSQL instance(instead of using local postgresql use supabase) IoT readings are inserted directly via the FastAPI endpoint using SQLAlchemy. This provides concurrent read/write safety and enables SQL-based querying during exploration.
- Add a lightweight message queue (Redis) as a buffer between the FastAPI receiver and the database writer to decouple ingestion from storage, preventing data loss if the database is temporarily unavailable.

**Tradeoffs:**
- CSV files are simple and human-readable but risk data loss if the process crashes mid-write and do not support concurrent access. PostgreSQL adds operational overhead (installation, backups) but provides durability, indexing, and query flexibility. For a pilot with 5-10 households, files are sufficient; for anything beyond 50 households or concurrent dashboard access, PostgreSQL becomes necessary.
- The Redis buffer solves a real production problem but is premature for a laptop-scale system. It becomes valuable when the system receives thousands of readings per minute.

**Storage Schema (logical, independent of backend):**
- IoT readings table: `(device_id, user_account_id, timestamp, avg_wattage, reading_interval_minutes, ingestion_time)`
- OCR bills table: `(user_account_id, scan_timestamp, billing_period, total_kwh, total_bill_php, meralco_account_number, ingestion_time)`

---

### 2. Data Validation & Preprocessing

**Purpose:** Ensure that raw ingested data is clean, consistent, and ready for feature engineering. This stage handles missing timestamps, duplicate records, physically impossible values, and alignment to a uniform time grid. It also flags data quality issues that would compromise model reliability and generates a quality report.

**Baseline:**
- Timestamp conversion to UTC and sorting by `(device_id, timestamp)`.
- Deduplication: keep the first occurrence when multiple readings share the same timestamp for the same device.
- Forward-fill missing intervals up to 2 consecutive gaps (30 minutes). Mark larger gaps with a `data_quality_flag = 'gap'` column.
- Clip wattage to [0, 10000] to catch sensor faults. Values outside this range are set to NaN and treated as missing.
- Resample to a strict 15-minute grid per device using forward-fill, then flag any remaining nulls.
- Output: cleaned Parquet file per device per month (`data/clean/{device_id}/YYYY-MM.parquet`) and a JSON quality report summarizing row counts, gap durations, and outlier counts.

**Advanced:**
- Apply a rolling median filter (window=3) to dampen transient electrical noise that can cause single-point spikes.
- Train a lightweight Isolation Forest (contamination=0.01) on historical wattage distributions per device to identify and mask probable sensor anomalies before they enter the training set. Flagged points are excluded from model fitting but retained in a separate `anomaly_candidates` table for later review.
- Compute a basic data health score (0-100) based on gap fraction, outlier fraction, and timestamp regularity. If the score drops below 70 for a given device-day, suppress anomaly alerts and notify the user of a sensor issue.

**Tradeoffs:**
- The baseline is deterministic, fast, and transparent. It handles common sensor hiccups without introducing tunable parameters.
- The median filter smooths legitimate short spikes (e.g., a microwave turning on for 2 minutes), which could mask brief high-draw events. This is acceptable for bill-shock detection (which cares about sustained usage) but would be problematic for appliance-level disaggregation.
- Isolation Forest introduces an unsupervised model that itself can be wrong. It should be used as a soft mask during training, not as a hard filter during inference. The complexity cost is low (lightweight model, easy to retrain) and it helps bootstrap clean baselines when no labeled anomalies exist.

---

### 3. Feature Engineering

**Purpose:** Transform the cleaned, regularized time series into a feature matrix suitable for supervised learning. Each row corresponds to one 15-minute timestamp, with features capturing recent consumption history, temporal patterns, and contextual information that help the model distinguish normal from anomalous usage.

**Input:** Cleaned Parquet files from Stage 2, with uniform 15-minute grid, no missing values (gaps forward-filled and flagged).

**Baseline Features (10 features):**
- `lag_1`, `lag_2`, `lag_4`: wattage 15, 30, and 60 minutes ago. Captures immediate momentum.
- `lag_96`: wattage 24 hours ago (same time yesterday). Captures daily seasonality.
- `hour`: integer 0-23.
- `day_of_week`: integer 0-6.
- `is_weekend`: binary 0/1.
- `rolling_mean_4`: mean of last 4 readings (1 hour). Smooths short-term fluctuations.
- `rolling_std_4`: standard deviation of last 4 readings. Captures recent volatility.
- `hour_median`: historical median wattage for this hour-of-day across all available history for this device. Provides a personalized baseline expectation.

**Advanced Features (add approximately 8-10 features):**
- `rolling_mean_24h`: mean over last 96 readings (24 hours).
- `rolling_mean_7d_same_hour`: mean of the 7 most recent same-hour readings. Captures weekly pattern stability.
- `hour_sin`, `hour_cos`: sinusoidal encoding of hour to capture cyclical continuity (hour 23 is close to hour 0).
- `day_of_week_sin`, `day_of_week_cos`: sinusoidal encoding of day-of-week.
- `is_philippine_holiday`: binary flag from a static holiday CSV lookup.
- `billing_day_of_cycle`: days elapsed since billing period start (from OCR Contract B). Captures behavior changes as the billing deadline approaches.
- `temperature_manila`: external feature from a free weather API (if available). High temperatures correlate with air conditioner use.
- `gradient_1h`: `(lag_1 - lag_5)` as a simple trend indicator.

**Tradeoffs:**
- The baseline features are sufficient for a linear model or k-NN to capture diurnal patterns and recent context. They require minimal computation and are highly interpretable.
- Lag features become numerous if the window grows (e.g., adding lags up to 168 for a full week). Feature selection or regularization handles this.
- External features (holidays, weather) add a runtime dependency on external services, which is a failure point. They should be fetched asynchronously and cached; if unavailable, the feature defaults to a neutral value (0 or mean) without breaking the pipeline.
- Sinusoidal encodings are superior to raw integer hours for models that assume linear relationships, but they add no value for tree-based models that can learn non-monotonic splits. The feature engineering stage can conditionally include them based on the model type selected downstream.

**Implementation Note:** Feature computation is performed on a per-device basis using pandas `shift()` and `rolling()` operations. The output is a single Parquet file per device-month with columns: timestamp, all features, and the target variable (actual wattage at that timestamp, for supervised training). This file is the immutable training-ready dataset for that device and month.

---

### 4. Model Training

**Purpose:** Train forecasting models that predict the expected wattage for the next 15-minute interval. The anomaly detection logic (threshold-based comparison) is implemented in the deployment stage, not during training. This separation keeps models focused on regression accuracy and allows the anomaly threshold to be tuned independently of model retraining.

**Input:** Feature-target Parquet files from Stage 3, split into training, validation, and test periods using temporal order (no random shuffling).

**Training Strategy:** Walk-forward validation with expanding window. For each model, train on data up to day D, validate on day D+1 through D+7, then expand the training window and repeat. Final evaluation is on the last 14 days of available data.

**Target Variable:** `avg_wattage` (continuous float) for the current timestamp (the value we are predicting).

**Baseline Models (3 required):**

1. **Persistence Model (Naive Forecast)**
   - Prediction: ŷ_t = y_{t-1} (next wattage equals the most recent observation).
   - No training required. Computationally free.
   - Serves as the absolute minimum performance floor. If a complex model cannot beat this, it has learned nothing useful.
   - Strengths: zero parameters, instant inference, trivially explainable.
   - Limitations: cannot anticipate daily patterns; reacts to spikes one step late.

2. **Historical Median by Time-of-Day**
   - For each 15-minute slot of the day (96 slots), compute the median wattage over the last 30 days of training data.
   - Prediction: ŷ_t = median of all observations in the same 15-minute slot historically.
   - Requires only a lookup table per device (96 floats). Update incrementally by recalculating medians weekly.
   - Strengths: robust to outliers, captures diurnal patterns, no iterative training, interpretable ("your typical usage at 7:15 PM is 350W").
   - Limitations: does not adapt to recent trend changes within a day; weekly seasonality is averaged into the daily profile.

3. **Simple Exponential Smoothing**
   - Recursive update: ŷ_t = α · y_{t-1} + (1 - α) · ŷ_{t-1}, with α = 0.3.
   - Initialization: first prediction is the first observation; the model state is a single scalar (the current level).
   - Only one parameter (α), which can be grid-searched on validation data or set to a sensible default.
   - Strengths: adapts to recent level changes, computationally negligible, stateful online learning requires no batch retraining.
   - Limitations: no seasonal or trend component; will lag behind sustained changes and cannot anticipate daily peaks.

**Advanced Models (3 required):**

1. **Holt-Winters Exponential Smoothing (Additive Seasonality)**
   - Extends simple exponential smoothing with a trend component and a seasonal component (period = 96 for daily seasonality).
   - Three smoothing parameters (α for level, β for trend, γ for seasonal) fit via maximum likelihood on training data.
   - Produces point forecasts and can also estimate prediction variance for threshold setting.
   - Strengths: directly models the daily cycle, updates incrementally, well-studied statistical foundations, no feature engineering required beyond the raw series.
   - Limitations: assumes additive seasonality (peak amplitude is constant). May need multiplicative variant if variance scales with level. Does not handle weekly patterns natively.
   - Implementation: `statsmodels.tsa.holtwinters.ExponentialSmoothing` with seasonal_periods=96.

2. **LightGBM Regressor with Time-Series Cross-Validation**
   - Gradient boosted trees trained on the full baseline feature set (lags, calendar features, rolling statistics).
   - Configured with early stopping (50 rounds) and a time-series-aware split: train on chronological chunks, validate on the immediately following period.
   - Hyperparameters: 100 trees, max_depth=6, learning_rate=0.05. Tuned lightly via grid search on validation MAE.
   - Strengths: captures non-linear relationships and feature interactions automatically, handles mixed feature types, provides feature importance for interpretability, fast to train on CPU.
   - Limitations: requires batch retraining to incorporate new data; does not natively handle temporal ordering (relies on lag features to encode time). More parameters to monitor and tune than statistical models.

3. **LSTM Encoder-Decoder (Lightweight)**
   - Single-layer LSTM with 32 hidden units, input sequence length of 168 (7 days), output is a single value (next 15-minute interval).
   - Trained with Adam optimizer, MSE loss, batch size 64. Dropout (0.2) applied to the recurrent layer.
   - Input features: only the raw wattage sequence (univariate). No hand-crafted features needed; the LSTM learns temporal representations.
   - Strengths: can learn complex temporal dependencies including weekly patterns and long-range effects without explicit feature engineering. Naturally handles variable-length sequences.
   - Limitations: requires substantially more data per device to train effectively (likely 2+ months minimum). Training time is higher (minutes on CPU vs. seconds). Less interpretable than tree-based or statistical models. Hyperparameters (sequence length, hidden size, learning rate) require tuning.

**Tradeoffs Across Models:**
- The three baselines serve as a graduated complexity ladder: persistence (zero intelligence), median (daily pattern only), exponential smoothing (adaptive level). Together they establish a strong benchmark—any advanced model must beat exponential smoothing by a meaningful margin to justify its overhead.
- Holt-Winters is the natural first upgrade from simple exponential smoothing. It adds seasonality without the feature engineering and retraining burden of tree-based or neural models. For this use case (strong daily cycle), it is likely the most cost-effective improvement.
- LightGBM excels when auxiliary features (weather, billing cycle) have predictive power. If those features matter, LightGBM will outperform purely temporal models.
- LSTM is the highest-risk, highest-reward option. It may discover latent patterns missed by engineered features, but it is also most likely to overfit on small per-device datasets. It is a candidate for a global model trained across many households rather than per-device.

**Implementation Note on Model Selection:** Training all six models is appropriate during initial research and benchmarking. In production, select the single best-performing model based on walk-forward validation results and promote it to the deployment stage. Maintain the other implementations as reference baselines for periodic re-evaluation.

---

### 5. Model Evaluation

**Purpose:** Rigorously quantify each model's forecasting accuracy and, critically, its downstream effectiveness at detecting anomalies. Forecasting error (MAE, RMSE) is a proxy metric; the true measure of success is anomaly detection precision and recall on realistic scenarios. This stage produces a model ranking and a recommended anomaly threshold.

**Evaluation Protocol:**
- Split: chronologically sorted data. Last 14 days as test set; previous 7 days as validation set; rest as training.
- Walk-forward: evaluate each model on the test set one timestep at a time, using only information available up to that timestep. No future data leakage.
- Compute per-model residuals (actual - predicted) across the entire test set.

**Metrics (Forecasting):**
- Mean Absolute Error (MAE): interpretable in watts. "On average, the model misses by X watts."
- Root Mean Squared Error (RMSE): penalizes large errors more heavily. Large errors are exactly what we care about for anomaly detection.
- Mean Absolute Percentage Error (MAPE): scale-independent, useful for comparing across households with different consumption levels. Capped at 100% to handle near-zero baselines.

**Metrics (Anomaly Detection — evaluated via synthetic injection):**
- Inject synthetic anomalies into the test set at known timestamps: multiply actual wattage by 2.0, 2.5, and 3.0 at 30 randomly selected intervals per test period. Record the timestamps.
- Apply the anomaly rule: alert if |actual - predicted| > k · σ_residuals, where σ_residuals is computed from the validation set residuals and k is swept from 1.5 to 4.0.
- For each k, compute precision (fraction of alerts that correspond to injected anomalies) and recall (fraction of injected anomalies that triggered an alert).
- Report F1 score at the best k, and the precision-recall curve.

**Model Comparison:**
- Primary ranking metric: F1 score on anomaly detection at the optimal threshold.
- Secondary: MAE and RMSE for interpretability.
- Use Diebold-Mariano test (if comparing two models) to assess whether differences in forecast errors are statistically significant rather than noise.

**Baseline Evaluation Approach:**
- Run the evaluation as a Python script that loads test set predictions from each model (pre-computed and saved to disk during training) and computes all metrics. Output a JSON report (`evaluation/report_YYYY-MM-DD.json`) and CSV tables of per-model metrics.

**Advanced Evaluation Approach:**
- Simulate incremental online performance: for each timestep in the test set, update the model (for models that support online updates like exponential smoothing) with the true value after prediction, then move to the next timestep. This measures how quickly adaptive models recover from anomalies and whether they over-adapt (absorbing the anomaly into the baseline).
- Compute prediction interval coverage: for models that output uncertainty estimates (LightGBM quantile regression, Holt-Winters prediction intervals), check whether the 95% interval contains the true value 95% of the time. Poorly calibrated intervals lead to incorrect anomaly thresholds.
- Track alert latency end-to-end: time from raw IoT reading ingestion to anomaly alert availability. This validates the deployment architecture, not the model.

**Critical Check:** Ensure that synthetic anomalies are injected *after* any feature computation that could leak future information. For example, rolling means must be computed on the original (non-anomalous) data to avoid contaminating the baseline expectation.

**Tradeoffs:**
- Synthetic injection is an imperfect substitute for real anomalies. It assumes anomalies are pure magnitude spikes, but real anomalies may involve shape changes (e.g., a malfunctioning appliance that cycles on/off rapidly). This limitation is unavoidable until real user feedback is available. The evaluation must be updated after the pilot with empirical precision/recall based on user-confirmed anomalies.
- MAE is stable and interpretable but may hide a model that consistently underpredicts peaks (the most critical region for anomaly detection). Always inspect error distributions, not just scalar summaries.

---

### 6. Model Deployment

**Purpose:** Serve the trained model in a way that generates predictions on each new IoT reading within the required latency window (<5 minutes from reading to alert) and writes anomaly alerts to the database for dashboard consumption. The deployment design prioritizes simplicity and reliability over horizontal scalability.

**Baseline:**
- Serialize the single best-performing model (selected in Stage 5) to disk using `joblib` (for tree-based/statistical models) or save weights (for LSTM).
- A Python script (`inference_worker.py`) runs as a cron job every 5 minutes. It queries the database for all new IoT readings ingested since the last run, loads the model, generates predictions, computes anomaly scores, and inserts any triggered alerts (Contract C) into the alerts table.
- Model and anomaly threshold parameters are read from a configuration file (`config/deployment.yaml`).
- This approach has an inherent latency of up to 5 minutes (the cron interval) plus processing time.

**Advanced:**
- Package the model and inference logic into a FastAPI service inside a Docker container.
- Expose a REST endpoint: `POST /predict` that accepts a single IoT reading (Contract A) and returns an anomaly alert (Contract C) if triggered.
- The IoT ingestion service calls this endpoint immediately after persisting a new reading, eliminating scheduling latency.
- The model is loaded into memory at container startup and cached for the lifetime of the container.
- Container orchestration (Docker Compose locally; Kubernetes later) handles restarts and health checks.

**Anomaly Decision Logic (identical in both baseline and advanced):**
1. Receive new reading: actual wattage `y_t`, timestamp, device_id, user_account_id.
2. Generate predicted wattage `ŷ_t` using the deployed model.
3. Compute residual: `r_t = y_t - ŷ_t`. (One-sided: we only care about positive residuals — usage higher than expected.)
4. Retrieve threshold `k · σ_residuals` for this device from configuration. σ_residuals was computed on the validation set during evaluation.
5. If `r_t > threshold` AND the previous two readings also exceeded the threshold (sustained spike rule), generate an anomaly alert JSON (Contract C) and insert into database. The sustained rule prevents single-interval noise from triggering alerts.
6. Log `(timestamp, device_id, y_t, ŷ_t, r_t, alert_triggered)` to a predictions log table for monitoring.

**Tradeoffs:**
- The cron-based baseline is trivial to implement and debug but introduces scheduling latency. For a pilot with manual user checks, this is acceptable. It also does not scale: as data volume grows, processing all new readings in a batch may exceed the 5-minute window.
- The FastAPI service eliminates scheduling latency, supports concurrent requests naturally, and maps directly to production container orchestration. The operational complexity increases (container build, health checks, port management) but is well-supported by standard tooling.
- Model loading time matters: loading a large LightGBM model (many trees) or an LSTM model (weight matrices) from disk on every cron invocation adds latency. The FastAPI approach loads once and reuses, which is more efficient. For the cron baseline, keep the model artifact small by preferring statistical models or limiting tree depth.

**Rollback Strategy:** Store the previous model artifact alongside the new one. If the new model causes alert rate to spike or monitoring detects elevated error, revert the `config/deployment.yaml` model path to the previous version and restart the service. No code deployment needed.

---

### 7. Model Monitoring

**Purpose:** Detect when the deployed model's performance degrades due to data drift, concept drift, or infrastructure issues. Monitoring provides early warning before users experience degraded alert quality and lose trust in the system.

**Monitored Metrics:**

*Operational Metrics (infrastructure health):*
- Inference latency (p95): time from receiving a reading to returning a prediction. Alert if > 1 second (FastAPI) or > 2 minutes (cron batch).
- Error rate: fraction of inference calls that fail (model exception, NaN prediction, database write failure). Alert if > 1%.
- Throughput: readings processed per minute. Useful for capacity planning.

*Model Performance Metrics (prediction quality):*
- Mean Absolute Error (MAE) over a rolling 24-hour window per device. Compute using actual vs. predicted values from the predictions log.
- Residual distribution shift: compare the distribution of residuals in the last 7 days to the validation period distribution using Kolmogorov-Smirnov test or Population Stability Index. Significant shift indicates concept drift.
- Alert rate per device: fraction of readings that trigger an anomaly alert. If this exceeds 10% sustained over 3 days, the model's baseline is likely stale (it considers normal behavior anomalous) and needs retraining.
- Coverage: if using prediction intervals, what fraction of actual values fall within the interval. Should remain near the nominal rate (e.g., 95%).

**Baseline Monitoring:**
- A scheduled Python script runs daily (e.g., at midnight) and queries the predictions log table.
- Computes MAE, alert rate, and residual statistics for each active device over the past 24 hours and past 7 days.
- Writes results to a `monitoring/daily_report_YYYY-MM-DD.json` file.
- If any metric exceeds a hardcoded threshold, sends an email notification to the ML team using SMTP.
- Dashboard reads the latest monitoring report to display a simple health status indicator (green/yellow/red).

**Advanced Monitoring:**
- Integrate with a monitoring stack: Prometheus for metric collection (expose a `/metrics` endpoint from the FastAPI inference service) and Grafana for dashboards and alerting.
- Track feature-level drift using PSI on key features (e.g., `lag_1`, `hour_median`) comparing the last 7 days to the training distribution.
- Automated retraining trigger: if MAE or alert rate exceeds the threshold for N consecutive days, the monitoring system emits an event that triggers the training pipeline (Stage 4) to run with the latest data and promote a new model to staging for evaluation before production deployment.
- Shadow deployment: deploy a candidate model alongside the production model. Both receive predictions, but only production alerts are shown to users. Compare candidate performance silently for a validation period before promoting.

**Tradeoffs:**
- The baseline monitoring is sufficient for a small pilot with manual oversight. It requires no additional infrastructure.
- Prometheus/Grafana adds significant operational complexity (running and maintaining a monitoring stack) but becomes necessary when the system serves many users and downtime or degraded quality has real impact.
- Automated retraining is a high-risk automation. If the root cause of performance degradation is a data quality issue (e.g., sensor drift) rather than genuine concept drift, automated retraining will bake the problem into the new model. Manual review of retraining triggers is recommended until the system has been stable for several months.

**Critical Principle:** Monitoring must never be an afterthought. The predictions log table (Stages 6 and 7) is the central nervous system of model observability. It must be designed from day one to capture every prediction, its inputs, its output, and the final alert decision. Without this log, debugging production issues is guesswork.

---

## Pathway to Production

The architecture is designed to evolve incrementally without structural redesign. The following sequence represents a realistic progression from laptop development to a hardened production system:

**Phase 1 — Local Development (Current)**
- Single laptop, all components as Python scripts.
- Storage: local Parquet/CSV files.
- Orchestration: manual sequential execution or a single `run_pipeline.py` script.
- Inference: cron-based batch worker.
- Monitoring: daily script outputting JSON reports.
- This phase validates the data pipeline, model selection, and evaluation methodology.

**Phase 2 — Pilot Deployment (5-50 households)**
- Migrate storage to managed PostgreSQL (cloud or on-premise).
- Wrap inference in FastAPI Docker container; deploy on a single cloud VM or on-premise server.
- Replace cron with HTTP-based trigger from IoT ingestion service.
- Add a simple dashboard that reads from PostgreSQL and displays monitoring metrics.
- Retraining: run the training pipeline manually when monitoring indicates drift (likely monthly).
- This phase validates real-world latency, user feedback quality, and model stability.

**Phase 3 — Scaled Production (50-500+ households)**
- Containerize the entire pipeline: ingestion, preprocessing, training, evaluation, inference, monitoring.
- Orchestrate with Prefect or Airflow: scheduled training jobs, automated evaluation, model promotion with manual approval gate.
- Deploy inference service behind a load balancer with multiple replicas for throughput and availability.
- Implement shadow deployment for safe model rollouts.
- Integrate Prometheus/Grafana for comprehensive observability.
- Add a feature store (e.g., Feast) if feature engineering becomes a bottleneck shared across multiple models.
- This phase achieves production hardening with minimal rework because the component boundaries and data contracts were defined from the start.

The key architectural invariant across all phases is the **separation of concerns via data contracts**. The raw data schema (IoT, OCR) and the anomaly alert schema (Contract C) are stable interfaces. Any component can be replaced internally as long as it respects these contracts. This is what prevents the pipeline from requiring redesign as it scales.

---

## Recommendations for Maintaining Simplicity

1. **Default to the baseline option** for every component unless a measurable problem forces an upgrade. The baseline pipeline (file storage, cron inference, JSON monitoring) is fully functional and will carry the project through the pilot phase.

2. **Resist the urge to build the advanced version "just in case."** Every advanced component adds code, dependencies, and failure modes. Let actual operational pain (e.g., "the cron job misses readings," "I can't debug without better logs") drive upgrades.

3. **Keep the model deployment artifact simple.** Prefer models that produce predictions with minimal runtime dependencies. A statistical model that requires only `numpy` is more portable and debuggable than a deep learning model requiring `torch` and a GPU.

4. **Log everything from the start.** The predictions log is the single most valuable asset for debugging and improvement. It costs almost nothing to implement and saves days of investigation later.

5. **Test the full pipeline with synthetic data before connecting real devices.** Generate a month of realistic IoT data using a script, run the entire pipeline end-to-end, and verify that alerts appear as expected. This smoke test catches integration bugs before they affect real users.

6. **Document the rationale for every threshold and parameter** (anomaly k, α in exponential smoothing, gap-filling limit). These values will be questioned later, and the reasoning should not live only in someone's memory. A `config/README.md` file explaining each parameter is sufficient.

The architecture described here is deliberately straightforward. It favors clarity and debuggability over elegance, and it accepts that some manual steps (retraining, threshold tuning) are acceptable in early stages. This foundation can support years of incremental improvement without ever requiring a rewrite.

---

## Implementation Status (Completed Items)

This section summarizes the work already completed in the ML folder so the foundational architecture above remains unchanged.

### Pipeline Stages

- Stage 1 (Ingestion): FastAPI ingestion service with file-based and PostgreSQL ingestion paths implemented.
- Stage 2 (Preprocessing): File mode and PostgreSQL mode implemented; processed flag updates supported.
- Stage 3 (Feature Engineering): Baseline + advanced-lite feature engineering implemented.
- Stage 4 (Model Training): Six models implemented with walk-forward validation.
- Stage 5 (Evaluation): Anomaly detection F1 and Diebold-Mariano comparisons implemented; evaluation reports generated.
- Stage 6 (Deployment): Inference worker implemented; writes predictions and alerts to PostgreSQL.
- Stage 7 (Monitoring): Daily report generation and email alerting implemented.

### Data and Database

- PostgreSQL schema defined in init_tables.sql with all required tables and indexes.
- Supabase-backed DATABASE_URL configured via .env.
- IoT and OCR seed scripts available (seed_postgres.py).
- Ingestion DB endpoints implemented: /db/stats, /db/devices, /db/readings/{device_id}.
- JOIN endpoint implemented: /db/readings-with-bills (IoT readings joined to OCR bills by user and billing month).

### Artifacts and Outputs

- Prediction plot saved: output/reports/prediction_sample.png.
- Final summary JSON saved: output/reports/final_summary.json.
- Evaluation reports, ranking CSVs, and metrics logs stored under output/reports/.

### Project Hygiene

- Root gitignore updated to exclude ml/data/, ml/output/, ml/models/.
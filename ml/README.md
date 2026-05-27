# ML Service — FastAPI

FastAPI service hosting Bantay-Dagitab's machine-learning workloads —
anomaly detection (Contract C) per paper §IV.C / Table IV.C.2. The
chatbot is **not** in this service: per paper §IV.B / §VII.A.4, the
Django backend calls an external LLM API directly. Chatbot config lives
in `backend/.env`, not here.

## Endpoints

- **`GET /health`** — liveness probe (used by docker-compose).

Anomaly detection itself runs in **cron-worker mode** rather than as a
synchronous HTTP endpoint (ARCHITECTURE §6 "Baseline"). See *Inference
Worker* below.

## Architecture (post-rationalization)

Ingestion is owned by Django:

| Contract | Endpoint                              | Table                       |
|----------|---------------------------------------|-----------------------------|
| A (IoT)  | `POST /api/iot/readings/ingest/`      | `iot_monitoring_iotreading` |
| B (Bill) | `POST /api/billing/ingest/`           | `billing_bill`              |
| C (ML)   | `POST /api/analytics/ingest/`         | `analytics_anomalyalert`    |

The ML service:

- **Reads** Django's `iot_monitoring_iotreading` for new readings to score.
- **Pushes** Contract C alerts to Django's `POST /api/analytics/ingest/`
  with the `X-Service-Token` header (paper §VI.F.2).
- **Owns** only two internal observability tables:
  - `ml_predictions_log` — every prediction the worker emits (paper §VII.A.5).
  - `ml_worker_state` — cursor (`last_processed_reading_id`) and per-device
    sustained-counter (`consecutive_<device_id>`).

Schema DDL: [`ml_observability_tables.sql`](ml_observability_tables.sql).
Run it once against Supabase before starting the worker.

## Inference Worker

Cron-driven; runs through one pass of new readings on every invocation.

```bash
# Inside the ml container (or local venv with DATABASE_URL set):
python -m src.inference.run worker --config config/deployment.yaml
```

Per-pass behaviour:

1. Reads cursor `last_processed_reading_id` from `ml_worker_state`.
2. Fetches new rows from `iot_monitoring_iotreading WHERE id > cursor`.
3. Loads the deployed model (`config/deployment.yaml → deployment.model_path`)
   and computes per-row predictions, residuals, and the k·σ threshold.
4. Applies the sustained-3 rule and writes one row per reading to
   `ml_predictions_log`.
5. For every sustained trigger, POSTs a Contract C payload to
   `{BACKEND_API_URL}/analytics/ingest/`.
6. Advances the cursor; persists the per-device consecutive counters.

The worker fails fast (exit 2) if `BACKEND_API_URL` or
`SERVICE_ACCOUNT_TOKEN` are missing.

## Quick Start

### With Docker (from repo root)

```bash
docker compose up ml
```

Service is reachable at `http://localhost:8001`; FastAPI docs at
`http://localhost:8001/docs`.

### Without Docker

```bash
cd ml
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt

cp ../.env.example ../.env
# Fill in SECRET_KEY, DATABASE_URL, SERVICE_ACCOUNT_TOKEN, etc.
# (env is centralized at the repo root — see <repo_root>/.env.example)

uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Then in a separate shell, run the inference worker on demand:

```bash
python -m src.inference.run worker
```

## Environment Variables

All env vars live in the centralized **repo-root `.env`** (see
`<repo_root>/.env.example`). The ML service reads it via
`load_dotenv(PROJECT_ROOT.parent / ".env")` in `src/db/__init__.py`.

| Variable                  | Required | Notes                                                        |
|---------------------------|----------|--------------------------------------------------------------|
| `DEBUG`                   | No       | Sets log level to INFO.                                      |
| `DATABASE_URL`            | Yes      | Same Supabase DB as Django.                                  |
| `BACKEND_API_URL`         | Yes      | Django root, e.g., `http://backend:8000/api`.                |
| `SERVICE_ACCOUNT_TOKEN`   | Yes      | Same value Django uses; the worker presents it as `X-Service-Token`. |

LLM provider config also lives in the root `.env` but is consumed only
by Django (the chatbot lives in the Django side per paper §IV.B).

## Data Contracts

This service produces **Contract C** (anomaly alerts) and consumes
**Contract A** (IoT readings, indirectly via Django's table). Canonical
schemas live in the repo-root [`contracts/`](../contracts/) directory.

## Project Structure

```
ml/
├── app/
│   └── main.py                       # FastAPI app (/health)
├── src/
│   ├── django_client.py              # Contract C push client
│   ├── db/                           # Shared SQLAlchemy engine
│   ├── ingestion/                    # Dev-only CSV → Parquet consolidator
│   ├── preprocessing/                # Cleans Django table → training Parquet
│   ├── features/                     # Feature engineering
│   ├── models/                       # Model training (six models)
│   ├── evaluation/                   # Walk-forward eval + anomaly F1
│   ├── inference/                    # Inference worker (cron entry)
│   └── monitoring/                   # Daily monitoring report
├── config/
│   ├── deployment.yaml               # model_path + per-device thresholds
│   └── monitoring.yaml               # Monitoring thresholds
├── scripts/
│   ├── generate_synthetic_data.py    # Dev-only synthetic data generator
│   └── update_thresholds_from_eval.py
├── ml_observability_tables.sql       # ml_predictions_log + ml_worker_state
├── ARCHITECTURE.md
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

## Integration

The ML container runs on the `bantay-dagitab-network` Docker network and
reaches the Django backend at `http://backend:8000`. The inference
worker pushes every triggered alert through
`POST /api/analytics/ingest/`; Django writes it to
`analytics_anomalyalert` and the dashboard reads it via
`GET /api/analytics/recent-anomalies/`.

## Team Responsibilities

- Anomaly detection (Contract C, sustained-3 over k·σ) — *implemented*
- Forecasting baselines (persistence, median, exponential smoothing) — *implemented*
- Forecasting advanced (Holt-Winters, LightGBM, LSTM) — *implemented*
- Daily monitoring report (drift + health status) — *implemented*
- Pydantic-validated payloads matching Contract C — *implemented (Contract C push)*
- Health endpoint for orchestration — *done*

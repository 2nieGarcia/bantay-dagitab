# ML Service — FastAPI

FastAPI service that will host Bantay-Dagitab's machine-learning
workloads — anomaly detection (Contract C) and load forecasting — per
paper §IV.C / Table IV.C.2.

The chatbot is **not** in this service. Per paper §IV.B and §VII.A.4,
the Django backend calls an external LLM API directly. Chatbot config
lives in `backend/.env`, not here.

Currently implemented:

- **`GET /health`** — liveness probe.

Planned (not yet implemented):

- **`POST /anomaly/detect`** — Contract C anomaly detection (Isolation
  Forest, Z-score) backed by scikit-learn.
- **Forecasting endpoints** — baseline (persistence, historical median,
  exponential smoothing) and advanced (Holt-Winters, LightGBM, LSTM)
  forecasters per paper §A.3.

## Tech Stack

- **Framework:** FastAPI + Uvicorn
- **Validation:** Pydantic v2
- **Config:** `python-dotenv`

When anomaly detection is implemented, the paper's Table IV.C.2 stack
adds: `scikit-learn`, `pandas`, `numpy`, `statsmodels`, `lightgbm`,
`pyarrow`, `pyYAML`.

## Project Structure

```
ml/
├── app/
│   └── main.py            # FastAPI app + /health
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

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

cp .env.example .env

uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Environment Variables

See `.env.example`.

| Variable          | Required | Example                | Notes                                              |
|-------------------|----------|------------------------|----------------------------------------------------|
| `DEBUG`           | No       | `True`                 | Sets log level to INFO                             |
| `BACKEND_API_URL` | No       | `http://backend:8000/api` | Callback URL for pushing future anomaly results back |

LLM provider config does **not** belong here — it lives in
`backend/.env` because the chatbot lives in Django.

## Data Contracts

This service implements **Contract C** (anomaly alerts) when the
detector is added. The canonical schemas live in `/contracts/`.

## Integration

This service runs on the `bantay-dagitab-network` Docker network and is
reachable from the backend container at `http://ml:8001`. The Django
backend currently does not call this service — that integration will
appear when anomaly detection is built (Django will receive pushed
alerts via the backend callback URL).

## Team Responsibilities

- Anomaly detection (Contract C, Isolation Forest / Z-score) — *planned*
- Load forecasting (baselines and advanced models per §A.3) — *planned*
- Pydantic-validated request handling matching Contract schemas
- Health endpoint for orchestration — *done*

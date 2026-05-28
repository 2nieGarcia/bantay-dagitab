# Backend API — Django REST Framework

Django REST API for Bantay-Dagitab: persists IoT readings, OCR-digitized
MERALCO bills, ML anomaly alerts, and chatbot interactions; exposes the
conversational AI surface that calls an external OpenAI-compatible LLM
(Groq or Ollama) directly per paper §IV.B / §VII.A.4.

## Tech Stack

- **Framework:** Django 5.x + Django REST Framework
- **Auth:** djangorestframework-simplejwt (JWT with refresh rotation + blacklist)
- **API docs:** drf-spectacular (Swagger / ReDoc / OpenAPI schema)
- **Database:** PostgreSQL 15 (via dj-database-url)
- **OCR:** Tesseract OCR + OpenCV + Pillow
- **Static files:** WhiteNoise (production)
- **WSGI:** Gunicorn (production)
- **Chatbot LLM client:** `openai` SDK (OpenAI-compatible; works with Groq cloud and Ollama local)
- **HTTP client:** `requests`

## Project Structure

```
backend/
├── core/                       # Django project (settings, urls, wsgi)
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── users/                      # User profile, JWT auth surface
├── iot_monitoring/             # IoTReading model + ingest endpoint (Contract A)
├── billing/                    # Bill model + (planned) OCR ingest endpoint (Contract B)
├── analytics/                  # AnomalyAlert model + (planned) ML callback (Contract C)
├── chatbot/                    # ChatLog model + chat endpoints (Contract D)
│   ├── views.py                # ChatbotInteractionView, ChatHistoryView
│   ├── services.py             # LLMClient — calls external LLM API directly
│   ├── serializers.py          # Input/output DTOs
│   ├── models.py               # ChatLog
│   ├── admin.py                # Admin registration
│   └── urls.py                 # /ask/, /history/
├── requirements.txt
├── Dockerfile
├── manage.py
├── .env.example
└── README.md
```

## API Endpoints

| Method | Endpoint                          | Description                                          | Contract |
|--------|-----------------------------------|------------------------------------------------------|----------|
| POST   | `/api/token/`                     | Obtain JWT (access + refresh)                        | —        |
| POST   | `/api/token/refresh/`             | Rotate refresh token                                 | —        |
| GET    | `/api/schema/`                    | OpenAPI 3.0 schema                                   | —        |
| GET    | `/api/docs/`                      | Swagger UI                                           | —        |
| GET    | `/api/redoc/`                     | ReDoc                                                | —        |
| GET    | `/api/users/...`                  | User management                                      | —        |
| POST   | `/api/iot/readings/ingest/`       | Ingest IoT reading                                   | A        |
| GET    | `/api/iot/readings/`              | List the caller's IoT readings                       | A        |
| POST   | `/api/billing/ingest/`            | (Planned) OCR-digest a bill image                    | B        |
| GET    | `/api/billing/`                   | List the caller's bills                              | B        |
| GET    | `/api/analytics/`                 | List the caller's anomaly alerts                     | C        |
| POST   | `/api/chat/ask/`                  | Ask the chatbot (calls external LLM API directly)    | D        |
| GET    | `/api/chat/history/?limit=N`      | List the caller's chat history (default 50, max 200) | D        |

All endpoints except `/api/token/*`, `/api/schema/`, `/api/docs/`, `/api/redoc/`
require `Authorization: Bearer <access-token>`.

## Data Contracts

This module implements the persistence and API surface for all four
contracts in `/contracts/`. The chatbot endpoint (`/api/chat/ask/`)
assembles a Contract D context block from the caller's most recent
`Bill` and `AnomalyAlert` rows, calls an external OpenAI-compatible
LLM (Groq or Ollama) directly per paper §IV.B / §VII.A.4, and
persists the response into `chatbot_chatlog`. See
[docs/chatbot_integration.md](../docs/chatbot_integration.md) for the
full chatbot flow.

## Development Setup

### With Docker (recommended)

From the repository root:

```bash
cp .env.example .env
# Edit .env: set SECRET_KEY, DATABASE_URL, SERVICE_ACCOUNT_TOKEN, and
# LLM_BASE_URL / LLM_API_KEY / LLM_MODEL (Groq or Ollama).
docker compose up backend
```

### Without Docker

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# System dependencies for OCR
# Windows: Download Tesseract from https://github.com/UB-Mannheim/tesseract/wiki
# Ubuntu: sudo apt install tesseract-ocr tesseract-ocr-eng

# Configure environment (single source of truth at repo root)
cp ../.env.example ../.env
# Edit ../.env: set SECRET_KEY, DATABASE_URL, SERVICE_ACCOUNT_TOKEN, and
# LLM_BASE_URL / LLM_API_KEY / LLM_MODEL

# Migrate and run
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

## Environment Variables

All env vars live in the centralized **repo-root `.env`** (see
`<repo_root>/.env.example`). The backend reads it via
`load_dotenv(BASE_DIR.parent / ".env")` in `core/settings.py`. Summary:

| Variable                | Required             | Default | Notes                                                |
|-------------------------|----------------------|---------|------------------------------------------------------|
| `SECRET_KEY`            | Yes                  | —       | Django signing key                                   |
| `DATABASE_URL`          | Yes                  | —       | `postgres://user:pass@host:port/dbname`              |
| `RENDER`                | No                   | False   | Set to `True` in production (toggles DEBUG)          |
| `LLM_BASE_URL`          | Chatbot (else fallback) | —    | OpenAI-compatible endpoint; must end in `/v1`        |
| `LLM_API_KEY`           | Chatbot (else fallback) | —    | Groq `gsk_...` or Ollama dummy value                 |
| `LLM_MODEL`             | Chatbot (else fallback) | —    | e.g. `llama-3.3-70b-versatile`                       |
| `LLM_TIMEOUT_SECONDS`   | No                   | `30`    | HTTP timeout for the LLM call                        |

If any of the three `LLM_*` keys is blank, `/api/chat/ask/` returns its
canned fallback string instead of erroring.

## Authentication

JWT via djangorestframework-simplejwt:

```bash
# Obtain tokens
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_household","password":"..."}'

# Use the access token
curl -H "Authorization: Bearer <access>" http://localhost:8000/api/iot/readings/
```

Token lifetimes:
- Access: 60 minutes
- Refresh: 24 hours, rotated and blacklisted on each refresh

## Admin

Django admin is registered for every domain model. Create a superuser
(`python manage.py createsuperuser`) and visit
`http://localhost:8000/admin/`. ChatLog rows are filterable and
searchable.

## Team Responsibilities

- Database schema design (six entities, normalized to 3NF)
- REST API surface for Contracts A, B, D
- OCR integration (Contract B) — *in progress*
- Chatbot integration with external LLM API (Contract D) — *done*
- JWT auth, drf-spectacular API docs, Docker image — *done*

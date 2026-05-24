# Bantay-Dagitab

**An Integrated IoT, OCR, and Conversational AI Database System for Post-Paid Residential Energy Monitoring and Bill Shock Prevention in Metro Manila**

National University - Manila — Advanced Database Systems Capstone

---

## Project Overview

Low-income households on traditional post-paid MERALCO plans frequently suffer from "bill shock." This system provides:

- **Real-time energy monitoring** via low-cost IoT hardware (ESP32 + CT sensor)
- **OCR-based bill digitization** for MERALCO bills (Tesseract + OpenCV)
- **Anomaly detection** to warn users before billing cycle ends (scikit-learn)
- **Conversational AI chatbot** to explain bills and give energy-saving advice (Django → external OpenAI-compatible LLM, Groq or Ollama)

## Project Structure

```
Bantay-Dagitab/
├── contracts/           # JSON Schema data contracts (source of truth, A–D)
├── iot/                 # ESP32 firmware (Arduino)
├── backend/             # Django REST API + OCR engine + chatbot view (LLM caller)
├── ml/                  # FastAPI ML service (future anomaly detection + forecasting)
├── frontend/            # Next.js web dashboard
├── docs/                # Paper draft, integration docs, checklists
├── docker-compose.yml   # Orchestrates db, backend, ml services
└── README.md
```

## Tech Stack

| Layer            | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| **IoT/Hardware** | ESP32, CT Sensor (SCT-013-030), Arduino C/C++                    |
| **Frontend**     | Next.js, React, TypeScript, Tailwind CSS                         |
| **Backend**      | Django 5.x, Django REST Framework, drf-spectacular, SimpleJWT    |
| **Database**     | PostgreSQL 15                                                    |
| **OCR**          | Tesseract OCR, OpenCV, Pillow                                    |
| **ML/AI**        | FastAPI, OpenAI-compatible LLM (Groq cloud or Ollama local)      |
| **DevOps**       | Docker, Docker Compose                                           |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Git
- An LLM provider — either a free Groq API key (https://console.groq.com/) **or** local Ollama (https://ollama.com)

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd Bantay-Dagitab

# 2. Create env files from templates
cp backend/.env.example backend/.env
cp ml/.env.example ml/.env   # optional; ml has no secrets right now

# 3. Fill in backend/.env:
#    - SECRET_KEY  (any value for dev; compose overrides this anyway)
#    - DATABASE_URL  (compose overrides this with a local Postgres URL)
#    - LLM_BASE_URL, LLM_API_KEY, LLM_MODEL  (Groq or Ollama; see file for recipes)

# 4. Bring up the stack
docker compose up --build

# Access services:
# - Backend API + Swagger:  http://localhost:8000/api/docs/
# - ML service docs:        http://localhost:8001/docs
# - Frontend (dev):         cd frontend && npm install && npm run dev → http://localhost:3000
```

> **Note:** `docker compose up` will error if `backend/.env` does not exist (it is loaded via `env_file`). The file template is at `backend/.env.example`. If LLM keys are left blank, the chatbot returns a fallback string instead of failing.

### Development Setup (Individual Services)

Each service has its own README with specific setup instructions:

- [IoT Firmware](./iot/README.md)
- [Backend API](./backend/README.md)
- [ML Service](./ml/README.md)
- [Frontend](./frontend/README.md)

## API Contracts

All modules **must strictly conform** to the JSON contracts defined in `/contracts/`. These are the source of truth for inter-module integration.

| Contract                                          | Description            | Owner               | Status |
| ------------------------------------------------- | ---------------------- | ------------------- | ------ |
| [Contract A](./contracts/contract_a_iot.json)     | IoT → Database         | IoT/Backend Team    | ✅     |
| [Contract B](./contracts/contract_b_ocr.json)     | OCR → Database         | Web/OCR Team        | Schema done, OCR pipeline pending |
| [Contract C](./contracts/contract_c_anomaly.json) | ML Anomaly Alert       | ML Team             | Schema done, detector pending |
| [Contract D](./contracts/contract_d_chatbot.json) | Chatbot Query/Response | Web UI + ML Backend | ✅     |

## Subsystem Documentation

- [Chatbot Integration](./docs/chatbot_integration.md) — full operational doc for the Django → external LLM chat flow (Contract D)
- [Paper full draft](./docs/paper_full_draft.md) — the capstone paper
- [Paper / repo delta checklist](./docs/paper_delta_checklist.md) — what remains to align repo with paper claims
- [Screenshot mock-up guide](./docs/screenshot_mockup_guide.md) — capturing figures for the paper

## Team Responsibilities

- **IoT Team**: ESP32 firmware, sensor calibration, Contract A implementation
- **Backend Team**: Django API, database schema, OCR integration, Contract B
- **ML Team**: Anomaly detection (Contract C), chatbot integration with LLM (Contract D)
- **Frontend Team**: Dashboard UI, chatbot widget, Contract D (UI side)

## Privacy & Compliance

- Compliant with Philippine Data Privacy Act (RA 10173)
- Cascade-delete on every user-owned table (right of erasure)
- JWT authentication with refresh-token rotation + blacklisting
- No PII used in model training

## Success Metrics

- OCR field extraction accuracy: ≥85% on MERALCO bills
- Anomaly alert latency: <5 minutes from detection to display
- Chatbot response time: <10 seconds end-to-end under normal LLM availability
- User comprehension: validated via post-demo interviews (companion Quantitative Methods study)

## Documentation

Each service provides its own API documentation:

- **Backend (Django)**: Swagger UI via drf-spectacular at `/api/docs/`
- **ML Service (FastAPI)**: Auto-generated OpenAPI docs at `/docs`

---

_Supporting UN SDG 7: Affordable and Clean Energy_

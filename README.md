# Bantay-Dagitab

**An Integrated IoT and OCR-Based AI Framework for Post-Paid Residential Energy Monitoring and Bill Shock Prevention in Metro Manila**

National University - Manila

---

## Project Overview

Low-income households on traditional post-paid MERALCO plans frequently suffer from "bill shock." This system provides:

- **Real-time energy monitoring** via low-cost IoT hardware
- **OCR-based bill digitization** for MERALCO bills
- **Anomaly detection** to warn users before billing cycle ends
- **Conversational AI chatbot** to explain bills and provide energy-saving tips

## Project Structure

```
Bantay-Dagitab/
├── contracts/           # API/JSON data contracts (source of truth)
├── iot/                 # ESP32 firmware (Arduino)
├── backend/             # Django REST API + OCR engine
├── ml/                  # FastAPI ML service (anomaly detection + chatbot)
├── frontend/            # Web dashboard (TBA)
├── docker-compose.yml   # Orchestrates all services
└── README.md
```

## Tech Stack

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| **IoT/Hardware** | ESP32, CT Sensor, Arduino                      |
| **Frontend**     | TBA + CSS Library                              |
| **Backend**      | Django, Django REST Framework, drf-spectacular |
| **Database**     | PostgreSQL (Relational)                        |
| **OCR**          | Tesseract OCR, OpenCV                          |
| **ML/AI**        | FastAPI, Hugging Face LLM                      |
| **DevOps**       | Docker, Docker Compose                         |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd Bantay-Dagitab

# Start all services
docker-compose up --build

# Access services:
# - Backend API Docs: http://localhost:8000/api/docs/
# - ML API Docs: http://localhost:8001/docs
# - Frontend: http://localhost:3000 (when implemented)
```

### Development Setup (Individual Services)

Each service has its own README with specific setup instructions:

- [IoT Firmware](./iot/README.md)
- [Backend API](./backend/README.md)
- [ML Service](./ml/README.md)
- [Frontend](./frontend/README.md)

## API Contracts

All modules **must strictly conform** to the JSON contracts defined in `/contracts/`. These are the source of truth for integration.

| Contract                                          | Description            | Owner               |
| ------------------------------------------------- | ---------------------- | ------------------- |
| [Contract A](./contracts/contract_a_iot.json)     | IoT → Database         | IoT/Backend Team    |
| [Contract B](./contracts/contract_b_ocr.json)     | OCR → Database         | Web/OCR Team        |
| [Contract C](./contracts/contract_c_anomaly.json) | ML Anomaly Alert       | ML Team             |
| [Contract D](./contracts/contract_d_chatbot.json) | Chatbot Query/Response | Web UI + ML Backend |

## Team Responsibilities

- **IoT Team**: ESP32 firmware, sensor calibration, Contract A implementation
- **Backend Team**: Django API, database schema, OCR integration, Contract B
- **ML Team**: Anomaly detection, chatbot response generation, Contracts C & D
- **Frontend Team**: Dashboard UI, chatbot interface, Contract D (UI side)

## Privacy & Compliance

- Compliant with Philippine Data Privacy Act (RA 10173)
- User identifiers hashed at device level
- Explicit user consent required for cloud storage
- No PII used in model training

## Success Metrics

- OCR field extraction accuracy: ≥85% on MERALCO bills
- Anomaly alert latency: <5 minutes from detection to display
- User comprehension: Validated via n=5 post-demo interviews

## Documentation

Each service provides its own API documentation:

- **Backend (Django)**: Swagger UI via drf-spectacular at `/api/docs/`
- **ML Service (FastAPI)**: Auto-generated OpenAPI docs at `/docs`

---

_Supporting UN SDG 7: Affordable and Clean Energy_

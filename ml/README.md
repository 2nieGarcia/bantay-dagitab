# ML Service - Anomaly Detection & Chatbot

FastAPI-based machine learning service for anomaly detection and conversational AI.

## Tech Stack

- **Framework**: FastAPI
- **ML Libraries**: scikit-learn, pandas, numpy
- **Conversational AI**: Hugging Face Transformers
- **API Documentation**: Auto-generated OpenAPI (Swagger UI at `/docs`)

## Project Structure

```
ml/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── routers/
│   │   ├── anomaly.py       # Anomaly detection endpoints
│   │   └── chatbot.py       # Chatbot endpoints
│   ├── services/
│   │   ├── anomaly_detector.py
│   │   └── chatbot_service.py
│   ├── models/              # ML model artifacts
│   │   └── .gitkeep
│   └── schemas/
│       ├── anomaly.py       # Pydantic models for Contract C
│       └── chatbot.py       # Pydantic models for Contract D
├── requirements.txt
├── Dockerfile
└── README.md
```

## API Documentation

Once running, access the interactive API docs at:

- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc
- **OpenAPI JSON**: http://localhost:8001/openapi.json

## Data Contracts

This module implements:

- **Contract C** (producing): Anomaly detection alerts
- **Contract D** (producing): Chatbot responses

See `/contracts/` for full schemas.

## Development Setup

### Without Docker

```bash
cd ml

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8001
```

### With Docker

```bash
docker-compose up ml
```

## Environment Variables

Create `.env` file:

```env
# API Settings
API_HOST=0.0.0.0
API_PORT=8001
DEBUG=True

# Hugging Face
HF_MODEL_NAME=microsoft/DialoGPT-medium
HF_TOKEN=your_token_here  # Optional, for private models

# Backend API
BACKEND_API_URL=http://localhost:8000/api
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/anomaly/detect` | Analyze reading and detect anomalies |
| GET | `/anomaly/history/{user_id}` | Get anomaly history for user |
| POST | `/chatbot/query` | Send query to chatbot (Contract D) |
| GET | `/health` | Health check endpoint |

## Anomaly Detection

The anomaly detection module compares real-time IoT data against historical baselines:

```python
# Example algorithm options (TBD with ML lead):
# - Isolation Forest
# - Z-Score based detection
# - LSTM Autoencoder
# - Prophet for time-series
```

**Note**: Algorithm to be finalized in consultation with ML lead.

## Chatbot Implementation

Uses Hugging Face LLM with prompt engineering constrained to user's energy data:

```python
# Example prompt template
SYSTEM_PROMPT = """
You are an energy advisor for a Filipino household. 
Based on the user's billing data and detected anomalies, 
provide helpful explanations and energy-saving tips.
Always respond in a friendly, helpful manner.
Context: {context}
"""
```

## Sample Request/Response

### Anomaly Detection (Contract C)

```bash
curl -X POST http://localhost:8001/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "meter_manila_001",
    "user_account_id": "user_001",
    "timestamp": "2024-03-01T14:15:00Z",
    "avg_wattage": 450.5
  }'
```

### Chatbot Query (Contract D)

```bash
curl -X POST http://localhost:8001/chatbot/query \
  -H "Content-Type: application/json" \
  -d '{
    "user_account_id": "user_001",
    "user_query": "Why is my bill higher this month?"
  }'
```

## Team Responsibilities

- Anomaly detection algorithm selection and training
- Chatbot prompt engineering
- Model performance optimization
- Implement Contracts C and D

## TODO

- [ ] Finalize anomaly detection algorithm with ML lead
- [ ] Setup FastAPI project skeleton
- [ ] Implement anomaly detection service
- [ ] Integrate Hugging Face LLM for chatbot
- [ ] Create synthetic training data
- [ ] Setup model versioning

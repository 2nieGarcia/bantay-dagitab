# Backend API - Django REST Framework

Django-based REST API with OCR integration for MERALCO bill processing.

## Tech Stack

- **Framework**: Django 5.x + Django REST Framework
- **API Documentation**: drf-spectacular (Swagger/OpenAPI)
- **Database**: PostgreSQL
- **OCR Engine**: Tesseract OCR + OpenCV
- **Task Queue**: Celery (optional, for async OCR processing)

## Project Structure

```
backend/
├── bantay_dagitab/           # Django project
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── api/                      # Main API app
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   └── urls.py
├── ocr/                      # OCR processing module
│   ├── processor.py
│   ├── meralco_parser.py
│   └── utils.py
├── requirements.txt
├── Dockerfile
├── manage.py
└── README.md
```

## API Documentation

Once running, access the interactive API docs at:

- **Swagger UI**: http://localhost:8000/api/docs/
- **ReDoc**: http://localhost:8000/api/redoc/
- **OpenAPI Schema**: http://localhost:8000/api/schema/

## Data Contracts

This module implements:

- **Contract A** (receiving): IoT readings from ESP32 devices
- **Contract B** (producing): OCR extracted bill data

See `/contracts/` for full schemas.

## Development Setup

### Without Docker

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Install Tesseract OCR (system dependency)
# Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
# Ubuntu: sudo apt install tesseract-ocr

# Setup database
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

### With Docker

```bash
docker-compose up backend
```

## Environment Variables

Create `.env` file:

```env
DEBUG=True
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgres://user:pass@localhost:5432/bantay_dagitab
ALLOWED_HOSTS=localhost,127.0.0.1

# Tesseract path (Windows)
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/readings/` | Receive IoT power readings (Contract A) |
| GET | `/api/readings/` | List readings for a user |
| POST | `/api/bills/scan/` | Upload bill image for OCR |
| GET | `/api/bills/` | List scanned bills (Contract B) |
| GET | `/api/alerts/` | List anomaly alerts (from ML service) |

## drf-spectacular Setup

Already configured in `settings.py`:

```python
INSTALLED_APPS = [
    # ...
    'drf_spectacular',
]

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Bantay-Dagitab API',
    'DESCRIPTION': 'Energy Monitoring and Bill Shock Prevention API',
    'VERSION': '1.0.0',
}
```

## Team Responsibilities

- Database schema design
- REST API implementation
- OCR integration and MERALCO bill parsing
- Integration with ML service for anomaly alerts
- Implement Contracts A (receiver) and B (producer)

## TODO

- [ ] Setup Django project skeleton
- [ ] Implement reading ingestion endpoint
- [ ] Integrate Tesseract OCR
- [ ] Train OCR on MERALCO bill templates
- [ ] Add authentication (JWT)
- [ ] Setup drf-spectacular documentation

# Residential Energy Anomaly Detection

**Bill Shock Prevention for Post-Paid MERALCO Households**

---

## Overview

This project develops a low-cost machine learning system that monitors residential electricity consumption in near real-time, detects unusual usage patterns before the monthly billing cycle ends, and alerts households to prevent unexpected high bills ("bill shock").

The system targets low-to-middle-income post-paid residential households in Metro Manila served by MERALCO, combining IoT power monitoring, optical character recognition for bill digitization, and lightweight anomaly detection models.

**Problem:** Households on post-paid plans only see consumption data at month-end, leaving no opportunity to adjust behavior and avoid unaffordable bills.

**Solution:** 15-minute interval power monitoring with ML-based anomaly detection that alerts users when consumption deviates significantly from their historical baseline, providing time to investigate and reduce usage before costs accumulate.

---

## Project Status

**Phase:** Research and Development  
**Stage:** Pipeline construction and model evaluation  
**Target Pilot:** 5-10 households in Sampaloc, Manila

---

## Quick Start

### Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- Intel Core i5 or equivalent (system designed for laptop-scale development)
- 8 GB RAM minimum

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd energy-anomaly-detection

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### Verify Installation

```bash
# Run the test suite to confirm everything works
pytest tests/
```

### Generate Sample Data

The project includes a synthetic data generator for development and testing before real IoT hardware is available:

```bash
# Generate 30 days of synthetic data for 5 simulated households
python scripts/generate_synthetic_data.py --households 5 --days 30
```

Output appears in `data/synthetic/` as Parquet files.

### Run the Full Pipeline (Development Mode)

```bash
# Execute the entire pipeline end-to-end on synthetic data
python run_pipeline.py --config config/pipeline_dev.yaml
```

This runs data ingestion, preprocessing, feature engineering, model training, evaluation, and generates a summary report in `output/reports/`.

---

## Repository Structure

```
energy-anomaly-detection/
├── README.md                    # This file
├── ARCHITECTURE.md              # Detailed architecture documentation
├── requirements.txt             # Python dependencies
├── run_pipeline.py              # End-to-end pipeline runner
├── config/
│   ├── pipeline_dev.yaml        # Development pipeline configuration
│   ├── pipeline_prod.yaml       # Production pipeline configuration
│   └── deployment.yaml          # Inference service configuration
├── src/
│   ├── ingestion/               # Data ingestion from IoT and OCR sources
│   ├── preprocessing/           # Data cleaning, validation, gap handling
│   ├── features/                # Feature engineering and transformation
│   ├── models/                  # Model training and serialization
│   ├── evaluation/              # Model evaluation and comparison
│   ├── inference/               # Inference worker and anomaly logic
│   └── monitoring/              # Performance monitoring utilities
├── scripts/
│   ├── generate_synthetic_data.py
│   └── run_monitoring_report.py
├── tests/
│   ├── test_ingestion.py
│   ├── test_preprocessing.py
│   ├── test_features.py
│   ├── test_models.py
│   └── test_inference.py
├── data/
│   ├── raw/                     # Raw ingested data (gitignored)
│   ├── clean/                   # Preprocessed data (gitignored)
│   ├── features/                # Feature matrices (gitignored)
│   ├── synthetic/               # Synthetic development data (gitignored)
│   └── external/                # Holiday lists, weather data, etc.
├── models/                      # Serialized model artifacts (gitignored)
├── output/
│   ├── reports/                 # Evaluation and monitoring reports
│   └── logs/                    # Pipeline execution logs
└── notebooks/                   # Exploratory analysis and prototyping
```

---

## Core Concepts

### What the System Detects

The anomaly detection model identifies **sustained over-consumption** relative to a household's historical baseline. This is not simple threshold monitoring. The system learns each household's normal patterns—weekday vs weekend, morning vs evening, seasonal variations—and flags deviations that persist and could impact the monthly bill.

### How Anomalies Are Defined

An anomaly is a sustained period (typically 3 consecutive 15-minute readings) where actual consumption significantly exceeds the model's predicted consumption for that time period. Single-point spikes (e.g., a microwave running for 2 minutes) are filtered out as noise.

### Data Flow Summary

1. **IoT sensor** on the main power line measures wattage every 15 minutes
2. **OCR module** digitizes monthly MERALCO bills for historical context
3. **ML pipeline** processes readings, predicts expected usage, compares to actual
4. **Alerts** are generated when sustained deviation is detected
5. **Dashboard** displays usage trends and alerts to the household

### Model Philosophy

The project follows a **baseline-first approach.** Simple models are implemented and evaluated rigorously before any complex model is considered. A complex model is only adopted if it demonstrates a measurable, statistically significant improvement over simpler alternatives on the specific task of detecting bill-impacting anomalies.

Baseline models:
- Persistence (naive forecast)
- Historical median by time-of-day
- Simple exponential smoothing

Advanced models (evaluated but only deployed if justified):
- Holt-Winters exponential smoothing
- LightGBM gradient boosting
- Lightweight LSTM

The current deployed model selection and performance metrics are documented in `output/reports/latest_model_card.md`.

---

## Development Workflow

### Running Specific Pipeline Stages

Each stage can be executed independently for debugging and iteration:

```bash
# Run only ingestion
python -m src.ingestion.run --source synthetic --config config/pipeline_dev.yaml

# Run only preprocessing on ingested data
python -m src.preprocessing.run --input data/raw/ --output data/clean/

# Run only feature engineering
python -m src.features.run --input data/clean/ --output data/features/

# Run only model training
python -m src.models.train --input data/features/ --output models/

# Run only evaluation
python -m src.evaluation.evaluate --models models/ --output output/reports/
```

### Adding a New Model

1. Implement the model class in `src/models/` following the `BaseModel` interface
2. Register it in `src/models/registry.py`
3. Add configuration parameters in `config/pipeline_dev.yaml`
4. Run evaluation to compare against existing baselines
5. If performance justifies deployment, update `config/deployment.yaml`

### Working with Real IoT Data

When transitioning from synthetic to real data:

1. Configure the IoT endpoint URL in `config/pipeline_dev.yaml`
2. Ensure data contracts match the specification in `docs/data_contracts.md`
3. Run the ingestion stage to verify data lands correctly
4. Inspect quality reports before allowing data into the training pipeline

---

## Testing

```bash
# Run all tests
pytest tests/

# Run tests for a specific module
pytest tests/test_models.py

# Run with coverage report
pytest --cov=src tests/
```

Tests use synthetic data fixtures and do not require external services or hardware. Each pipeline stage has corresponding unit tests validating correct behavior on edge cases (missing data, extreme values, empty inputs).

---

## Data Contracts

All system components communicate via defined JSON schemas. The full specification is in `docs/data_contracts.md`. Critical contracts:

| Contract | Source | Consumer | Purpose |
|----------|--------|----------|---------|
| Contract A | IoT sensor | Database | 15-minute wattage readings |
| Contract B | OCR module | Database | Monthly bill extractions |
| Contract C | ML inference | Dashboard | Anomaly alerts |
| Contract D | Dashboard/ML | Chatbot | User queries and responses |

Deviation from these contracts causes integration failures. Validate any changes against the contract specification before merging.

---

## Monitoring

The pipeline generates daily monitoring reports in `output/reports/`. Key tracked metrics:

- **MAE:** Mean Absolute Error of predictions (watts)
- **Alert rate:** Fraction of readings triggering alerts (should remain low)
- **Data quality score:** Completeness and validity of incoming IoT data
- **Inference latency:** Time from reading receipt to alert generation

A monitoring report is generated by:

```bash
python scripts/run_monitoring_report.py --date $(date +%Y-%m-%d)
```

---

## Configuration

All tunable parameters live in YAML configuration files under `config/`:

- `pipeline_dev.yaml` — Development and experimentation settings
- `pipeline_prod.yaml` — Production settings (higher thresholds, conservative alerting)
- `deployment.yaml` — Model path, anomaly threshold, sustained spike rule parameters

Never hardcode thresholds or paths. Reference configuration values in all pipeline code.

---

## Dependencies

Core libraries (see `requirements.txt` for pinned versions):

- **pandas, numpy** — Data manipulation
- **scikit-learn** — Baseline models and evaluation metrics
- **statsmodels** — Statistical models (Holt-Winters)
- **LightGBM** — Gradient boosting (optional, for advanced comparison)
- **PyTorch** — LSTM implementation (optional, for advanced comparison)
- **FastAPI, uvicorn** — Inference service
- **pytest** — Testing
- **PyYAML** — Configuration parsing

No GPU required. All models train and infer on CPU.

---

## Contributing

1. Create a branch from `main` for your feature or fix
2. Implement changes, respecting existing module boundaries and data contracts
3. Add or update tests covering the new behavior
4. Run the full test suite (`pytest tests/`) before committing
5. Run the pipeline end-to-end on synthetic data to verify no regressions
6. Open a pull request with a clear description of changes and motivation

For model contributions, include evaluation results comparing the new model against current baselines.

---

## Privacy and Ethics

This project handles household energy consumption data with the following commitments:

- All data collection complies with the Philippine Data Privacy Act (RA 10173)
- User identifiers are hashed at the device level
- No personally identifiable information is used in model training
- Cloud storage requires explicit user consent
- Users can request data deletion at any time

See `docs/privacy_policy.md` for the complete policy.

---

## License

[License information to be added before public release]

---

## Contact

- **ML Lead:** Ken Ira Lacson
- **IoT/Backend Team:** [Contact]
- **Web/OCR Team:** [Contact]

---

## Related Documentation

- `ARCHITECTURE.md` — Full pipeline architecture and design rationale
- `docs/data_contracts.md` — JSON schemas for all inter-component communication
- `docs/model_card.md` — Current deployed model details and performance
- `docs/evaluation_protocol.md` — Anomaly detection evaluation methodology
- `notebooks/` — Exploratory analysis and prototyping notebooks
# API/JSON Data Contracts

This folder contains the **source of truth** for all inter-module data contracts. 

⚠️ **All modules must strictly conform to these contracts regardless of internal implementation.**

## Contracts Overview

| File | Description | Owner |
|------|-------------|-------|
| `contract_a_iot.json` | IoT device → Database readings | IoT/Backend Team |
| `contract_b_ocr.json` | OCR extracted bill data → Database | Web/OCR Team |
| `contract_c_anomaly.json` | ML anomaly alert output | ML Team |
| `contract_d_chatbot.json` | Chatbot query/response format | Web UI + ML Backend |

## Schema Format

All contracts use [JSON Schema Draft-07](https://json-schema.org/draft-07/json-schema-release-notes.html) format and include:

- Field descriptions
- Data types and constraints
- Example values
- Required vs optional fields

## Usage

### For Validation

You can validate your payloads against these schemas using any JSON Schema validator:

**Python:**
```python
import jsonschema
import json

with open('contracts/contract_a_iot.json') as f:
    schema = json.load(f)

payload = {
    "device_id": "meter_manila_001",
    "user_account_id": "user_001",
    "timestamp": "2024-03-01T14:15:00Z",
    "avg_wattage": 450.5,
    "reading_interval_minutes": 15
}

jsonschema.validate(payload, schema)  # Raises exception if invalid
```

**JavaScript:**
```javascript
const Ajv = require('ajv');
const ajv = new Ajv();
const schema = require('./contracts/contract_a_iot.json');
const validate = ajv.compile(schema);

const payload = {
  device_id: "meter_manila_001",
  // ...
};

if (!validate(payload)) {
  console.error(validate.errors);
}
```

## Making Changes

1. **Propose changes** via PR with clear justification
2. **All affected teams must approve** before merging
3. **Update all consuming modules** simultaneously
4. **Version bump** if breaking changes are introduced

## Key Design Decisions

- `user_account_id` is present in **all contracts** for consistent user-to-device mapping
- Timestamps use **ISO 8601 format** with UTC timezone
- Currency amounts are in **Philippine Pesos (PHP)**
- Wattage values are **floating-point numbers**

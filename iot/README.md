# IoT Firmware - ESP32 Power Monitor

ESP32-based firmware for real-time household power monitoring using CT (Current Transformer) sensors.

## Hardware Requirements

- **Microcontroller**: ESP32 (DevKit V1 or similar)
- **Sensor**: Non-invasive CT Sensor (TBA - e.g., SCT-013-030)
- **Additional**: 
  - 10kΩ burden resistor
  - 2x 10kΩ voltage divider resistors
  - 10µF capacitor

## Tech Stack

- **Language**: Arduino (C++)
- **Libraries**: 
  - WiFi.h (ESP32 WiFi)
  - HTTPClient.h (HTTP requests)
  - ArduinoJson.h (JSON serialization)
  - EmonLib (Energy monitoring - optional)

## Project Structure

```
iot/
├── firmware/
│   └── power_monitor/
│       ├── power_monitor.ino    # Main Arduino sketch
│       ├── config.h             # WiFi/API configuration
│       └── ct_sensor.h          # CT sensor calibration
├── docs/
│   └── wiring_diagram.md
└── README.md
```

## Configuration

Create `config.h` with your settings:

```cpp
#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
const char* WIFI_SSID = "your_wifi_ssid";
const char* WIFI_PASSWORD = "your_wifi_password";

// API Configuration
const char* API_ENDPOINT = "http://your-backend-url/api/readings/";
const char* DEVICE_ID = "meter_manila_001";
const char* USER_ACCOUNT_ID = "user_001";

// Sensor Configuration
const int CT_PIN = 34;  // ADC pin for CT sensor
const float CT_CALIBRATION = 30.0;  // Adjust based on your CT sensor
const int READING_INTERVAL_MINUTES = 15;

#endif
```

## Data Contract

This module implements **Contract A** - IoT to Database:

```json
{
  "device_id": "meter_manila_001",
  "user_account_id": "user_001",
  "timestamp": "2024-03-01T14:15:00Z",
  "avg_wattage": 450.5,
  "reading_interval_minutes": 15
}
```

See `/contracts/contract_a_iot.json` for the full schema.

## Development Setup

1. Install [Arduino IDE](https://www.arduino.cc/en/software) or [PlatformIO](https://platformio.org/)
2. Install ESP32 board support
3. Install required libraries via Library Manager
4. Copy `config.h.example` to `config.h` and fill in your values
5. Connect ESP32 and upload

## Uploading Firmware

```bash
# Arduino CLI
arduino-cli compile --fqbn esp32:esp32:esp32 power_monitor
arduino-cli upload -p COM3 --fqbn esp32:esp32:esp32 power_monitor

# Or use Arduino IDE / PlatformIO GUI
```

## Testing Without Hardware

For development, you can simulate readings by modifying the sensor read function to return test values.

## Team Responsibilities

- Sensor calibration and accuracy testing
- WiFi reconnection handling
- Battery/power optimization (if applicable)
- Implement Contract A payload format

## TODO

- [ ] Select specific CT sensor model
- [ ] Create wiring diagram
- [ ] Implement sensor calibration routine
- [ ] Add OTA (Over-The-Air) update support
- [ ] Add local data buffering for offline scenarios

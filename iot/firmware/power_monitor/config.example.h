/* ============================================================
   Bantay-Dagitab — power_monitor config TEMPLATE.

   USAGE
   -----
   1. Copy this file to `config.h` in the same directory.
   2. Fill in the real values for your deployment.
   3. `config.h` is gitignored — never commit credentials.

   Required Arduino IDE libraries:
     - ESP8266 board package (already installed; you ran Stage 1)
     - ArduinoJson (>= 6.x)            Sketch → Include Library → Manage Libraries

   This file ships every knob the firmware needs. Defaults are
   safe for local development against a Django dev server.
   ============================================================ */

#ifndef BANTAY_DAGITAB_CONFIG_H
#define BANTAY_DAGITAB_CONFIG_H

// ---------- WiFi ----------
#define WIFI_SSID                  "your-wifi-ssid"
#define WIFI_PASSWORD              "your-wifi-password"

// ---------- Backend ----------
// Local dev: http://<your-laptop-LAN-ip>:8000
// Production: https://<your-render-host>.onrender.com
#define API_BASE_URL               "http://192.168.1.100:8000"
#define INGEST_PATH                "/api/iot/readings/ingest/"

// X-Service-Token: only required after RBAC P2.12 lands and the
// ingest view switches from AllowAny to IsServiceAccount.
// Leave blank for current backend state.
#define SERVICE_TOKEN              ""

// ---------- Contract A identity ----------
// device_id: any stable string; convention used elsewhere is
//   meter_<barangay>_<NNN>, e.g. "meter_sampaloc_001"
// user_account_id: auth_user.id of the household head in Postgres.
// Create the user in Django admin, copy the integer PK here.
#define DEVICE_ID                  "meter_sampaloc_001"
#define USER_ACCOUNT_ID            1

// ---------- Sampling / reporting cadence ----------
// Paper §IV.B: averaged wattage over 15-minute windows.
#define READING_INTERVAL_MINUTES   15

// One RMS burst per minute (15 sub-samples per window). The
// burst itself is ~RMS_BURST_MS long; between bursts the chip
// is idle, so WiFi stays stable.
#define SUB_SAMPLE_PERIOD_S        60

// Duration of one RMS sampling burst. 200 ms ≈ 12 cycles @60 Hz,
// which is more than enough cycles for a stable RMS.
#define RMS_BURST_MS               200

// ---------- CT calibration ----------
// Determined in Stage 2 against a known resistive load.
// I_rms_amps = adc_rms_counts * CT_CALIBRATION
//
// Theoretical value for SCT-013-000 (100 A : 50 mA), 33 Ω burden,
// 1.65 V bias on ESP8266 A0 is ≈ 0.0625. Replace with your
// measured value before deployment.
#define CT_CALIBRATION             0.0625f

// MERALCO single-phase residential nominal. Used to convert RMS
// current to apparent power for non-revenue monitoring purposes.
// For resistive loads, VA ≈ W. For inductive loads (aircon,
// refrigerator compressors) this overstates real W by the
// power-factor margin; that's the accepted limitation of any
// single-CT design.
#define MAINS_VOLTAGE_V            230.0f

// ADC midpoint observed in Stage 1. 1.65 V on a 3.3 V / 1024 ADC.
// If your Stage 1 average was, say, 498 instead of 512, set this
// to 498 — the RMS subtracts this before squaring.
#define ADC_BIAS_COUNTS            512.0f

// ---------- Time ----------
// Paper §IV.C: "all timestamps are UTC ISO 8601".
#define NTP_SERVER_PRIMARY         "pool.ntp.org"
#define NTP_SERVER_SECONDARY       "time.nist.gov"
#define TZ_OFFSET_SECONDS          0

// ---------- Behavior ----------
// If a POST fails, retry this many times with linear backoff
// before discarding the window.
#define POST_MAX_RETRIES           3
#define POST_RETRY_BACKOFF_MS      2000

// Reboot if WiFi hasn't reconnected this long. Defensive only.
#define WIFI_RECONNECT_TIMEOUT_MS  60000UL

#endif  // BANTAY_DAGITAB_CONFIG_H

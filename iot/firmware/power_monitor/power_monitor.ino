/* ============================================================
   Bantay-Dagitab — POWER MONITOR (final firmware)

   Aligned with paper §II.B.2 / §IV.B / Contract A
   (contracts/contract_a_iot.json).

   What it does
   ------------
   1. Connects to WiFi (reconnects on drop, reboots on prolonged
      outage).
   2. Syncs NTP so timestamps are real UTC ISO-8601 strings.
   3. Once per SUB_SAMPLE_PERIOD_S takes one RMS burst on A0,
      converts to amps via CT_CALIBRATION, then to apparent power
      via MAINS_VOLTAGE_V.
   4. Accumulates a windowed mean over READING_INTERVAL_MINUTES.
   5. POSTs a Contract A JSON payload to
      <API_BASE_URL><INGEST_PATH> and resets the accumulator.

   Contract A payload shape (per contracts/contract_a_iot.json):
     {
       "device_id":                "meter_sampaloc_001",
       "user_account_id":          1,
       "timestamp":                "2026-05-27T10:30:00Z",
       "avg_wattage":              412.7,
       "reading_interval_minutes": 15
     }

   Board:        "NodeMCU 1.0 (ESP-12E Module)"
   Libraries:    ESP8266 board pkg, ArduinoJson (>=6.x)
   Credentials:  config.h (copy from config.example.h, gitignored)
   ============================================================ */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <math.h>

#include "config.h"

// ---------- Pins ----------
static const int CT_PIN = A0;

// ---------- Derived constants ----------
static const unsigned long WINDOW_MS =
    (unsigned long)READING_INTERVAL_MINUTES * 60UL * 1000UL;
static const unsigned long SUBSAMPLE_MS =
    (unsigned long)SUB_SAMPLE_PERIOD_S * 1000UL;

// ---------- Accumulator state ----------
struct Accumulator {
  double   watts_sum;        // sum of per-sub-sample apparent power
  uint32_t sample_count;     // number of sub-samples in this window
  unsigned long window_start_ms;
  unsigned long last_subsample_ms;
};

static Accumulator g_acc;

// ============================================================
//                       NETWORK
// ============================================================

static void connectWiFi() {
  Serial.print(F("[wifi] connecting to "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print('.');
    yield();
    if (millis() - t0 > WIFI_RECONNECT_TIMEOUT_MS) {
      Serial.println();
      Serial.println(F("[wifi] timeout, rebooting"));
      ESP.restart();
    }
  }
  Serial.println();
  Serial.print(F("[wifi] ok ip="));
  Serial.print(WiFi.localIP());
  Serial.print(F(" rssi="));
  Serial.println(WiFi.RSSI());
}

static void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println(F("[wifi] lost, reconnecting"));
  connectWiFi();
}

static void syncNTP() {
  Serial.print(F("[ntp] sync"));
  configTime(TZ_OFFSET_SECONDS, 0,
             NTP_SERVER_PRIMARY, NTP_SERVER_SECONDARY);
  unsigned long t0 = millis();
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(250);
    Serial.print('.');
    now = time(nullptr);
    yield();
    if (millis() - t0 > 30000UL) {
      Serial.println();
      Serial.println(F("[ntp] timeout (will retry on next POST)"));
      return;
    }
  }
  Serial.println();
  Serial.print(F("[ntp] ok utc="));
  Serial.println((long)now);
}

static bool buildIsoUtc(char *out, size_t len) {
  time_t now = time(nullptr);
  if (now < 8 * 3600 * 2) return false;
  struct tm tmv;
  gmtime_r(&now, &tmv);
  snprintf(out, len, "%04d-%02d-%02dT%02d:%02d:%02dZ",
           tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday,
           tmv.tm_hour, tmv.tm_min, tmv.tm_sec);
  return true;
}

// ============================================================
//                       SENSING
// ============================================================

// One RMS burst. Returns RMS *current in amps* on the primary side
// of the CT, using CT_CALIBRATION determined in Stage 2.
static float measureRmsCurrent() {
  unsigned long t_end = millis() + RMS_BURST_MS;
  double sq_sum = 0.0;
  uint32_t n = 0;
  while ((long)(millis() - t_end) < 0) {
    int raw = analogRead(CT_PIN);
    float centered = (float)raw - ADC_BIAS_COUNTS;
    sq_sum += (double)centered * (double)centered;
    n++;
    yield();
  }
  if (n == 0) return 0.0f;
  float adc_rms = sqrtf((float)(sq_sum / (double)n));
  return adc_rms * CT_CALIBRATION;
}

// ============================================================
//                       UPLOAD
// ============================================================

static bool postContractA(float avg_wattage, const char *iso_ts) {
  ensureWiFi();

  WiFiClient client;          // swap to BearSSL::WiFiClientSecure for HTTPS prod
  HTTPClient http;
  String url = String(API_BASE_URL) + INGEST_PATH;

  StaticJsonDocument<256> doc;
  doc["device_id"]                = DEVICE_ID;
  doc["user_account_id"]          = USER_ACCOUNT_ID;
  doc["timestamp"]                = iso_ts;
  doc["avg_wattage"]              = avg_wattage;
  doc["reading_interval_minutes"] = READING_INTERVAL_MINUTES;

  String body;
  serializeJson(doc, body);

  for (uint8_t attempt = 1; attempt <= POST_MAX_RETRIES; attempt++) {
    if (!http.begin(client, url)) {
      Serial.println(F("[post] http.begin() failed"));
      delay(POST_RETRY_BACKOFF_MS * attempt);
      continue;
    }
    http.addHeader(F("Content-Type"), F("application/json"));
    if (strlen(SERVICE_TOKEN) > 0) {
      http.addHeader(F("X-Service-Token"), SERVICE_TOKEN);
    }

    Serial.print(F("[post] attempt "));
    Serial.print(attempt);
    Serial.print(F(" -> "));
    Serial.println(url);
    Serial.print(F("[post] body="));
    Serial.println(body);

    int code = http.POST(body);
    String resp = http.getString();
    http.end();

    Serial.print(F("[post] status="));
    Serial.print(code);
    Serial.print(F(" resp="));
    Serial.println(resp);

    if (code >= 200 && code < 300) return true;
    if (code == 400 || code == 422) {
      // Permanent: malformed payload. Don't retry, log and drop.
      Serial.println(F("[post] permanent client error; dropping"));
      return false;
    }
    delay(POST_RETRY_BACKOFF_MS * attempt);
    yield();
  }
  Serial.println(F("[post] exhausted retries; dropping window"));
  return false;
}

// ============================================================
//                       LIFECYCLE
// ============================================================

static void resetAccumulator() {
  g_acc.watts_sum         = 0.0;
  g_acc.sample_count      = 0;
  g_acc.window_start_ms   = millis();
  g_acc.last_subsample_ms = 0;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println(F("=================================="));
  Serial.println(F(" Bantay-Dagitab Power Monitor"));
  Serial.print  (F(" device_id      = "));
  Serial.println(DEVICE_ID);
  Serial.print  (F(" user_account_id= "));
  Serial.println(USER_ACCOUNT_ID);
  Serial.print  (F(" window         = "));
  Serial.print  (READING_INTERVAL_MINUTES);
  Serial.println(F(" min"));
  Serial.print  (F(" sub-sample     = "));
  Serial.print  (SUB_SAMPLE_PERIOD_S);
  Serial.println(F(" s"));
  Serial.print  (F(" CT_CALIBRATION = "));
  Serial.println(CT_CALIBRATION, 6);
  Serial.println(F("=================================="));

  pinMode(CT_PIN, INPUT);
  connectWiFi();
  syncNTP();
  resetAccumulator();
}

void loop() {
  ensureWiFi();

  const unsigned long now = millis();

  // ---- Sub-sample tick ----
  bool first_sub = (g_acc.last_subsample_ms == 0);
  if (first_sub || now - g_acc.last_subsample_ms >= SUBSAMPLE_MS) {
    float i_rms_a = measureRmsCurrent();
    float watts   = i_rms_a * MAINS_VOLTAGE_V;

    g_acc.watts_sum   += watts;
    g_acc.sample_count++;
    g_acc.last_subsample_ms = now;

    Serial.print(F("[sub] n="));
    Serial.print(g_acc.sample_count);
    Serial.print(F("  I_rms="));
    Serial.print(i_rms_a, 4);
    Serial.print(F(" A   W="));
    Serial.println(watts, 2);
  }

  // ---- Window close ----
  if (now - g_acc.window_start_ms >= WINDOW_MS) {
    float avg_w = (g_acc.sample_count > 0)
                      ? (float)(g_acc.watts_sum / (double)g_acc.sample_count)
                      : 0.0f;

    Serial.println(F("--------------------------------"));
    Serial.print(F("[window] avg_wattage="));
    Serial.print(avg_w, 2);
    Serial.print(F(" W over "));
    Serial.print(g_acc.sample_count);
    Serial.println(F(" sub-samples"));

    char iso[32];
    if (buildIsoUtc(iso, sizeof(iso))) {
      postContractA(avg_w, iso);
    } else {
      Serial.println(F("[window] NTP not synced; retrying NTP and skipping POST"));
      syncNTP();
    }
    Serial.println(F("--------------------------------"));
    resetAccumulator();
  }

  delay(50);
  yield();
}

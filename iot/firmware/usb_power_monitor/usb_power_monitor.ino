/* ============================================================
   Bantay-Dagitab — USB POWER MONITOR (No WiFi Required)

   This is what you upload to the Arduino IDE!
   
   It reads AC current from the CT sensor and prints JSON over
   USB serial. A Python bridge script on your PC reads the JSON
   and posts it to the Django backend.

   NO WiFi, NO NTP — just USB cable to your laptop.

   Upload steps:
   1. Open this file in Arduino IDE.
   2. Board: "NodeMCU 1.0 (ESP-12E Module)"
   3. Port: Select the COM port your NodeMCU is on (e.g. COM3)
   4. Click Upload (→ arrow button)
   5. After upload, run the Python bridge script.

   Board: "NodeMCU 1.0 (ESP-12E Module)"
   No libraries required.
   ============================================================ */

const int CT_PIN = A0;
const unsigned long BAUD = 115200;

// Burst length per measurement (~12 cycles at 60 Hz)
const unsigned long RMS_BURST_MS = 200;

// Exponential moving average smoothing factor.
const float EMA_ALPHA = 0.15f;

// Your calibrated CT factor from Stage 2!
const float CT_CALIBRATION = 0.090253f;

// Meralco residential mains voltage (Philippines)
const float MAINS_VOLTAGE_V = 230.0f;

// How often to output a reading (milliseconds).
// 1 second = real-time dashboard updates.
const unsigned long OUTPUT_INTERVAL_MS = 1000;

float g_ema = NAN;
float g_ema_bias = NAN;
unsigned long g_last_output = 0;

// Dynamic auto-bias RMS measurement (same as Stage 2)
float measureAdcRmsBurst(float &out_bias) {
  unsigned long t_end = millis() + RMS_BURST_MS;
  double sq_sum = 0.0;
  double sum = 0.0;
  uint32_t n = 0;
  
  while ((long)(millis() - t_end) < 0) {
    int raw = analogRead(CT_PIN);
    sum += raw;
    sq_sum += (double)raw * (double)raw;
    n++;
    yield();
  }
  
  if (n == 0) {
    out_bias = 512.0f;
    return 0.0f;
  }
  
  float mean = (float)(sum / (double)n);
  out_bias = mean;
  
  float variance = (float)((sq_sum / (double)n) - ((double)mean * (double)mean));
  if (variance < 0.0f) variance = 0.0f;
  
  return sqrtf(variance);
}

void setup() {
  Serial.begin(BAUD);
  delay(500);
  
  // Print a startup marker so the bridge script knows we're alive
  Serial.println();
  Serial.println(F("{\"status\":\"ready\",\"firmware\":\"usb_power_monitor\",\"ct_cal\":0.090253}"));
  
  g_last_output = millis();
}

void loop() {
  // Take a measurement
  float current_bias = 512.0f;
  float ac_rms = measureAdcRmsBurst(current_bias);

  // Smooth using EMA
  if (isnan(g_ema)) {
    g_ema = ac_rms;
    g_ema_bias = current_bias;
  } else {
    g_ema = (EMA_ALPHA * ac_rms) + ((1.0f - EMA_ALPHA) * g_ema);
    g_ema_bias = (EMA_ALPHA * current_bias) + ((1.0f - EMA_ALPHA) * g_ema_bias);
  }

  // Output a JSON reading at the configured interval
  unsigned long now = millis();
  if (now - g_last_output >= OUTPUT_INTERVAL_MS) {
    g_last_output = now;

    // Calculate real-world values
    float current_amps = g_ema * CT_CALIBRATION;
    float power_watts = current_amps * MAINS_VOLTAGE_V;

    // Suppress ghost readings from noise floor
    if (g_ema < 1.5f) {
      current_amps = 0.0f;
      power_watts = 0.0f;
    }

    // Output as a single JSON line — the bridge script parses this
    Serial.print(F("{\"avg_wattage\":"));
    Serial.print(power_watts, 2);
    Serial.print(F(",\"current_amps\":"));
    Serial.print(current_amps, 4);
    Serial.print(F(",\"ac_rms\":"));
    Serial.print(g_ema, 2);
    Serial.print(F(",\"bias\":"));
    Serial.print(g_ema_bias, 1);
    Serial.println(F("}"));
  }

  delay(50);
  yield();
}

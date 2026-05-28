/* ============================================================
   Bantay-Dagitab — STAGE 2: CT CALIBRATION & LIVE POWER METER
   
   This sketch does two things:
   1. Calibration Mode: Re-derives the CT_CALIBRATION factor
      against a known load (your 1400 W hairdryer).
   2. Live Measurement Mode: Uses your new calibration factor
      (0.090253) to display real-world electrical metrics.

   WHAT CAN WE MEASURE AND CALCULATE AFTER AC CURRENT?
   -------------------------------------------------
   Clamping an AC current sensor around a wire allows us to measure
   and calculate a wide range of electrical metrics:
   1. Dynamic DC Bias: The center offset of your NodeMCU ADC.
   2. AC Wave Size: The raw peak-to-peak amplitude (in ADC counts).
   3. Current RMS (Amps): The effective continuous current.
   4. Current Peak (Amps): The maximum peak value of the AC sine wave.
   5. AC Voltage (Volts): The assumed mains voltage (230 V).
   6. Active Power (Watts): Real-time electricity usage.
   7. Cumulative Energy (Watt-hours, Wh): Total energy consumed since
      the NodeMCU booted up.

   Board: "NodeMCU 1.0 (ESP-12E Module)"
   No libraries required.
   ============================================================ */

const int CT_PIN = A0;
const unsigned long BAUD = 115200;

// Burst length per measurement (~12 cycles at 60 Hz)
const unsigned long RMS_BURST_MS = 200;

// Exponential moving average smoothing factor.
// Lower = smoother, slower to settle.
const float EMA_ALPHA = 0.10f;

// ---------- CALIBRATION CONSTANTS ----------
const float KNOWN_LOAD_WATTS = 1400.0f; // Your hairdryer rating
const float MAINS_VOLTAGE_V  = 230.0f;  // Nominal residential voltage

// Your newly calibrated factor! We use this to show you real-world values.
const float CALIBRATED_CT_CALIBRATION = 0.090253f;

// Expected AC current: Power / Voltage = 1400 / 230 ≈ 6.087 Amps
const float EXPECTED_I_RMS = KNOWN_LOAD_WATTS / MAINS_VOLTAGE_V;

// ---------- GLOBAL STATE ----------
float g_ema = NAN;
float g_ema_bias = NAN;

// Energy accumulation variables
float g_energy_ws = 0.0f;          // Watt-seconds consumed since startup
unsigned long g_last_loop_ms = 0;  // Last time loop ran to calculate elapsed time

// Dynamically calculates both the DC bias (average) and the pure AC RMS of the wave.
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
  delay(300);
  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("    Bantay-Dagitab — STAGE 2: LIVE AC POWER METER "));
  Serial.println(F("=================================================="));
  Serial.print(F("Calibrated Factor (config.h): "));
  Serial.println(CALIBRATED_CT_CALIBRATION, 6);
  Serial.print(F("Assumed Mains Voltage     : "));
  Serial.print(MAINS_VOLTAGE_V, 1);
  Serial.println(F(" V AC"));
  Serial.println(F("=================================================="));
  Serial.println();
  
  g_last_loop_ms = millis();
}

void loop() {
  // Calculate elapsed time since the last loop iteration
  unsigned long now = millis();
  float elapsed_sec = 0.0f;
  if (g_last_loop_ms > 0 && now > g_last_loop_ms) {
    elapsed_sec = (float)(now - g_last_loop_ms) / 1000.0f;
  }
  g_last_loop_ms = now;

  float current_bias = 512.0f;
  float ac_rms = measureAdcRmsBurst(current_bias);

  // Smooth raw measurements using Exponential Moving Average
  if (isnan(g_ema)) {
    g_ema = ac_rms;
    g_ema_bias = current_bias;
  } else {
    g_ema = (EMA_ALPHA * ac_rms) + ((1.0f - EMA_ALPHA) * g_ema);
    g_ema_bias = (EMA_ALPHA * current_bias) + ((1.0f - EMA_ALPHA) * g_ema_bias);
  }

  // --- 1. CALCULATE CALIBRATION FACTOR ---
  float suggested_cal = 0.0f;
  if (g_ema > 3.0f) {
    suggested_cal = EXPECTED_I_RMS / g_ema;
  }

  // --- 2. CALCULATE REAL-WORLD AC METRICS ---
  // AC Current RMS
  float current_amps = g_ema * CALIBRATED_CT_CALIBRATION;
  
  // AC Current Peak (I_peak = I_rms * sqrt(2))
  float peak_amps = current_amps * 1.4142f;
  
  // Real-time Active Power (Watts)
  float power_watts = current_amps * MAINS_VOLTAGE_V;

  // Accumulate energy (Watt-seconds) only if there is an active load
  if (power_watts > 1.0f) {
    g_energy_ws += power_watts * elapsed_sec;
  }
  // Convert Watt-seconds to Watt-hours (1 Wh = 3600 Watt-seconds)
  float energy_wh = g_energy_ws / 3600.0f;

  // --- 3. FORMATTED TELEMETRY GRID OUTPUT ---
  Serial.println(F("+------------------------------------------------------------------------------+"));
  Serial.println(F("|                        BANTAY-DAGITAB AC POWER TELEMETRY                     |"));
  Serial.println(F("+------------------------------------------------------------------------------+"));
  
  // Row 1: Raw Microcontroller Data
  Serial.print(F("| [RAW]    ADC Bias: ")); 
  Serial.print(g_ema_bias, 1); 
  Serial.print(F(" counts       | AC Wave RMS Size: ")); 
  Serial.print(g_ema, 2); 
  Serial.println(F(" counts           |"));

  // Row 2: Current Meters
  Serial.print(F("| [METERS] AC Current: ")); 
  Serial.print(current_amps, 4); 
  Serial.print(F(" Amps RMS  | Peak Current:     ")); 
  Serial.print(peak_amps, 4); 
  Serial.println(F(" Amps Peak     |"));

  // Row 3: Power Grid State
  Serial.print(F("| [POWER]  AC Voltage: ")); 
  Serial.print(MAINS_VOLTAGE_V, 1); 
  Serial.print(F(" Volts RMS | Real-time Power:  ")); 
  Serial.print(power_watts, 1); 
  Serial.println(F(" Watts         |"));

  // Row 4: Cumulative Energy usage
  Serial.print(F("| [ENERGY] Total Consumption: ")); 
  Serial.print(energy_wh, 5); 
  Serial.println(F(" Wh (Watt-hours since start)          |"));

  // Row 5: Calibration Helper
  Serial.println(F("+------------------------------------------------------------------------------+"));
  if (g_ema > 3.0f) {
    Serial.print(F("| [CALIB]  SUGGESTED CT_CALIBRATION = "));
    Serial.print(suggested_cal, 6);
    Serial.println(F(" (Hairdryer ON)                        |"));
  } else {
    Serial.println(F("| [CALIB]  [STATUS] Idle: No active load detected.                             |"));
  }
  Serial.println(F("+------------------------------------------------------------------------------+"));
  Serial.println();

  delay(1000); // 1-second cadence is much cleaner to read in Serial Monitor
  yield();
}


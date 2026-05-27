/* ============================================================
   Bantay-Dagitab — STAGE 2: CT CALIBRATION
   Run this once with a known resistive load to derive the
   CT_CALIBRATION constant that goes into config.h for Stage 3.

   PROCEDURE
   ---------
   1. Pick a known resistive load. A bare incandescent bulb works
      well (label wattage is honest). Avoid switching-mode supplies
      (laptops, LED drivers): their current is non-sinusoidal and
      will give you a calibration that under-reads everything else.
        Example targets at 230 V mains:
          60  W bulb → ~0.261 A_rms
          100 W bulb → ~0.435 A_rms
          1500 W kettle → ~6.52 A_rms   (best signal-to-noise)

   2. Clamp the CT around ONE conductor feeding that load only.
   3. Switch the load on, leave it running.
   4. Watch the serial output. Wait ~30 s for the running average
      to stabilize. Note the printed "adc_rms" value.
   5. Compute:
            CT_CALIBRATION = expected_I_rms_A / adc_rms

      e.g. 1500 W kettle at 230 V:
            expected = 1500 / 230 = 6.522 A
            if adc_rms reads 104.3 → CT_CALIBRATION = 0.0625

   6. Paste that float into config.h and move to Stage 3.

   Board: "NodeMCU 1.0 (ESP-12E Module)"
   No libraries required.
   ============================================================ */

const int CT_PIN = A0;
const unsigned long BAUD = 115200;

// Burst length per measurement (~12 cycles at 60 Hz)
const unsigned long RMS_BURST_MS = 200;

// ADC midpoint determined in Stage 1. 1.65 V on a 3.3 V / 1024 ADC.
const float ADC_BIAS_COUNTS = 512.0f;

// Exponential moving average smoothing factor for the printed RMS.
// Lower = smoother, slower to settle.
const float EMA_ALPHA = 0.10f;

float g_ema = NAN;

float measureAdcRmsBurst() {
  unsigned long t_end = millis() + RMS_BURST_MS;
  double sq_sum = 0.0;
  uint32_t n = 0;
  while ((long)(millis() - t_end) < 0) {
    int raw = analogRead(CT_PIN);
    float centered = (float)raw - ADC_BIAS_COUNTS;
    sq_sum += centered * centered;
    n++;
    yield();
  }
  if (n == 0) return 0.0f;
  return sqrtf((float)(sq_sum / (double)n));
}

void setup() {
  Serial.begin(BAUD);
  delay(300);
  Serial.println();
  Serial.println(F("=================================="));
  Serial.println(F(" STAGE 2 - CT calibration"));
  Serial.println(F("=================================="));
  Serial.println(F("Clamp CT around a known load and wait ~30 s."));
  Serial.println(F("CT_CALIBRATION = (P_label / 230 V) / adc_rms"));
  Serial.println();
}

void loop() {
  float adc_rms = measureAdcRmsBurst();

  if (isnan(g_ema)) g_ema = adc_rms;
  else              g_ema = (EMA_ALPHA * adc_rms) + ((1.0f - EMA_ALPHA) * g_ema);

  Serial.print(F("adc_rms (instant) = "));
  Serial.print(adc_rms, 2);
  Serial.print(F("   adc_rms (smoothed) = "));
  Serial.print(g_ema, 2);
  Serial.println(F("   <-- use the smoothed value once stable"));

  delay(250);
  yield();
}

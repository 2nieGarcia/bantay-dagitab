/* ============================================================
   Bantay-Dagitab — STAGE 1: WIRING CHECK
   Upload THIS first. It does NOT compute wattage.
   It only reads A0 and prints raw counts + voltage so you can
   confirm the 1.65 V bias divider is wired correctly.

   Board in Arduino IDE: "NodeMCU 1.0 (ESP-12E Module)"
   No libraries needed for this stage.

   Wiring expectation:
     3V3 ──[10 kΩ]──┬──[10 kΩ]── GND     (bias divider)
                    │
                    ├── A0                (NodeMCU)
                    │
              CT secondary across this node and GND
              with a 33 Ω burden resistor in parallel
   ============================================================ */

const int CT_PIN = A0;    // NodeMCU's only analog pin
const int SAMPLES = 200;  // samples per printed report
const unsigned long BAUD = 115200;

void setup() {
  Serial.begin(BAUD);
  delay(300);
  Serial.println();
  Serial.println(F("=================================="));
  Serial.println(F(" STAGE 1 - A0 bias / wiring check"));
  Serial.println(F("=================================="));
  Serial.println(F("Target with no current: raw ~512, ~1.65 V"));
  Serial.println();
}

void loop() {
  long sum = 0;
  int vmin = 1023, vmax = 0;

  for (int i = 0; i < SAMPLES; i++) {
    int v = analogRead(CT_PIN);
    sum += v;
    if (v < vmin) vmin = v;
    if (v > vmax) vmax = v;
    delay(2);
    yield();
  }

  float avg = sum / (float)SAMPLES;
  float voltage = avg * (3.3f / 1023.0f);
  int swing = vmax - vmin;

  Serial.print(F("raw avg = "));
  Serial.print(avg, 1);
  Serial.print(F("   voltage = "));
  Serial.print(voltage, 3);
  Serial.print(F(" V   min="));
  Serial.print(vmin);
  Serial.print(F(" max="));
  Serial.print(vmax);
  Serial.print(F(" swing="));
  Serial.print(swing);

  if (avg < 60) {
    Serial.println(F("   <-- BAD: near 0 (check GND side / A0 row)"));
  } else if (avg > 960) {
    Serial.println(F("   <-- BAD: near max (check 3V3 side / R missing)"));
  } else if (avg > 460 && avg < 560) {
    if (swing < 8)
      Serial.println(F("   <-- BIAS OK (steady). Clamp CT to see swing."));
    else
      Serial.println(F("   <-- BIAS OK + signal swinging. Ready for Stage 2!"));
  } else {
    Serial.println(F("   <-- bias off-center: resistors may be unequal"));
  }

  delay(500);
}

# IoT Firmware — Bantay-Dagitab Power Monitor

NodeMCU ESP8266 (ESP-12E) firmware for residential power monitoring via a clip-on CT sensor. Implements **Contract A** — see [contracts/contract_a_iot.json](../contracts/contract_a_iot.json).

> **Paper alignment note.** §II / §IV.C / §III.A.1 refer to "ESP32" throughout. The actual hardware is NodeMCU ESP-12E (ESP8266). The two platforms are treated as interchangeable for residential sub-metering in the cited literature (Nebrida 2023, Aga 2025), and Contract A is identical on the wire. Update §II.E.1 / §IV.C to read "NodeMCU ESP-12E (ESP8266)" before defense if you want the paper to match the chip.

## Hardware

- **MCU:** NodeMCU 1.0 (ESP-12E Module) — ESP8266 @ 80 MHz, 4 MB flash, single ADC on A0 (0–3.3 V, 10-bit)
- **CT clamp:** SCT-013-000 (100 A : 50 mA) or equivalent
- **Burden resistor:** 33 Ω across the CT secondary
- **Bias divider:** 2 × 10 kΩ from 3V3 → GND, midpoint to A0
- **Optional:** 10 µF decoupling cap across the bias midpoint to GND

Wiring:

```
3V3 ──[10 kΩ]──┬──[10 kΩ]── GND
               │
               ├── A0 (NodeMCU)
               │
        CT secondary across this node and GND
        with the 33 Ω burden resistor in parallel
```

## Repo layout

```
iot/
├── README.md                                          (this file)
└── firmware/
    ├── stage1_wiring_check/stage1_wiring_check.ino   bias-check, no compute
    ├── stage2_calibration/stage2_calibration.ino     derive CT_CALIBRATION
    └── power_monitor/
        ├── power_monitor.ino                         final firmware
        ├── config.example.h                          committed template
        └── config.h                                  you create this, gitignored
```

## Bring-up — three stages

The firmware ships in three sketches so each layer is validated before the next. Don't skip ahead: Stage 2 is what decides whether your watt readings are physically correct.

### Stage 1 — Wiring check

Open [firmware/stage1_wiring_check/stage1_wiring_check.ino](firmware/stage1_wiring_check/stage1_wiring_check.ino).

- Board in Arduino IDE: **NodeMCU 1.0 (ESP-12E Module)**
- No libraries required.

Upload, open Serial Monitor at 115200 baud. With nothing clamped, expect `raw avg ≈ 512`, `voltage ≈ 1.65 V`, and the verdict `BIAS OK (steady). Clamp CT to see swing.` Clamp the CT around a live conductor with current flowing (turn on a kettle) — verdict should flip to `BIAS OK + signal swinging. Ready for Stage 2!`.

Verdicts to act on if you don't get the above:

| Verdict | Cause |
|---|---|
| `near 0` | GND side of divider broken, or A0 shorted to GND |
| `near max` | GND-side resistor missing, or A0 shorted to 3V3 |
| `bias off-center` | The two 10 kΩ resistors aren't matched — swap one in |

### Stage 2 — CT calibration

Open [firmware/stage2_calibration/stage2_calibration.ino](firmware/stage2_calibration/stage2_calibration.ino). No libraries required.

Pick a known resistive load — a 1500 W kettle gives the cleanest signal-to-noise. Avoid switching-mode supplies (laptops, LED drivers): their current is non-sinusoidal and yields a calibration that under-reads everything else.

Compute the expected RMS current from the label:

```
expected_I_rms = P_label / 230 V        # 1500 / 230 = 6.522 A for a 1500 W kettle
```

Clamp the CT around **one** conductor feeding the load only (not both — the magnetic fields cancel and you'll read zero). Switch the load on. Watch the Serial Monitor; the smoothed `adc_rms` figure stabilizes after ~30 s.

Calibration constant:

```
CT_CALIBRATION = expected_I_rms / adc_rms_smoothed
```

Save that float — it goes into `config.h` in the next step. For SCT-013-000 with a 33 Ω burden the theoretical value is ≈ 0.0625; your measured value should be in that neighborhood.

### Stage 3 — Final firmware

```bash
cp iot/firmware/power_monitor/config.example.h iot/firmware/power_monitor/config.h
```

Install **ArduinoJson** (≥ 6.x) from the Arduino IDE Library Manager. Open [firmware/power_monitor/power_monitor.ino](firmware/power_monitor/power_monitor.ino), edit `config.h`:

| Field | What to put |
|---|---|
| `WIFI_SSID` / `WIFI_PASSWORD` | The 2.4 GHz network the meter will live on. ESP8266 has no 5 GHz radio. |
| `API_BASE_URL` | Local dev: `http://<your-laptop-LAN-ip>:8000`. Production: your Render host. |
| `DEVICE_ID` | Unique stable string per meter, e.g. `meter_sampaloc_001`. Must match `users_profile.device_id` after the household claims it. |
| `USER_ACCOUNT_ID` | Integer `auth_user.id` from Django admin. **Temporary** — see "Future: device-claim flow" below. |
| `CT_CALIBRATION` | From Stage 2. |
| `ADC_BIAS_COUNTS` | From Stage 1 (usually `512.0f`; adjust if your divider isn't perfectly symmetric). |
| `SERVICE_TOKEN` | Leave blank. Required only after RBAC P2.12 lands and `IoTReadingCreateView` switches from `AllowAny` to `IsServiceAccount`. |

Upload. Serial Monitor prints `[sub] n=… I_rms=… A W=…` once per `SUB_SAMPLE_PERIOD_S` and a `[window] avg_wattage=…` + POST once per `READING_INTERVAL_MINUTES`.

**Smoke test before deployment.** In `config.h` temporarily set:

```c
#define SUB_SAMPLE_PERIOD_S       10
#define READING_INTERVAL_MINUTES   1
```

You'll get a POST every minute instead of every 15. Watch the Django dev server logs and confirm an `IoTReading` row appears in `/admin/`. Revert to `60` / `15` for real deployment.

## Contract A payload

```json
{
  "device_id":                "meter_sampaloc_001",
  "user_account_id":          1,
  "timestamp":                "2026-05-27T10:30:00Z",
  "avg_wattage":              412.7,
  "reading_interval_minutes": 15
}
```

Posted to `POST /api/iot/readings/ingest/` per paper §IV.B. Schema authoritative at [contracts/contract_a_iot.json](../contracts/contract_a_iot.json).

> **Known contract divergence (D6).** The JSON Schema declares `user_account_id` as a string (`"user_001"`); the backend `IoTReadingSerializer` resolves it as an integer FK against `auth_user.id`. The firmware sends an integer (what the backend wants). Update the schema's `"type"` from `"string"` to `"integer"` before defense.

## Future: device-claim flow

The hardcoded `USER_ACCOUNT_ID` works for the academic demo but doesn't scale and doesn't match the operational story in §VII.A.9 ("settings → IoT device controls"). The schema already supports the right design: `users_profile.device_id` is unique and exists for exactly this binding.

**Target flow:**

1. At provisioning, each meter is flashed with a fixed `DEVICE_ID` printed on a sticker on the enclosure.
2. Household registers via `/register` (already works).
3. Household navigates to Settings → "Link my meter" → enters the `device_id` from the sticker → backend writes `request.user.profile.device_id = X`.
4. Firmware sends `device_id` only — no `user_account_id`.
5. Backend ingest endpoint resolves `Profile.objects.get(device_id=…).user` and stuffs that FK on every row.

**Touchpoints to implement when ready:**

- [backend/iot_monitoring/serializers.py](../backend/iot_monitoring/serializers.py) — `IoTReadingSerializer.create()` resolves user from `device_id` instead of accepting `user_account_id` in the payload. Return 404 if the device is unclaimed.
- [backend/users/views.py](../backend/users/views.py) — new `POST /api/users/me/link-device/` taking `{device_id}`. Refuse re-binding so a stolen sticker can't hijack an already-claimed device.
- [frontend/components/settings/index.tsx](../frontend/components/settings/index.tsx) — text input + button under the existing "IoT device controls" section.
- [firmware/power_monitor/power_monitor.ino](firmware/power_monitor/power_monitor.ino) — drop `doc["user_account_id"]` and the `USER_ACCOUNT_ID` macro from config.h.

**Threat tradeoff:** anyone who learns a `device_id` could spoof readings. Mitigations in order of effort:

| Mitigation | When to pick it |
|---|---|
| Accept the risk | Academic demo; data is non-financial; blast radius is local network. |
| One-shot claim (recommended) | Link-device endpoint refuses to re-bind an already-claimed device_id. Three lines of view code. |
| Per-device token | New `devices` table maps `token → device_id → user`; firmware sends as `X-Service-Token`. Most secure but expands the schema beyond the six entities the paper enumerates in §V.A. |

## Limitations of this design

Acknowledge these in §II.E rather than hoping a defense panel won't probe.

- **Single CT measures apparent power (VA), not real power (W).** For purely resistive loads (incandescent bulbs, kettles, heaters) VA = W. For inductive loads (compressors, motors) VA overstates W by the power-factor margin (typically 0.7–0.9). Adding a voltage channel + phase measurement would give true W but doubles the hardware. Every cited Philippine sub-meter paper carries the same limitation.
- **No local buffering.** If WiFi or the backend is down at window-close time, that 15-minute slice is dropped (firmware logs `dropping window` and continues). A LittleFS-backed retry queue is feasible but out of scope.
- **No OTA updates.** Re-flash requires USB.
- **2.4 GHz only.** ESP8266 has no 5 GHz radio.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `WiFi: timeout, rebooting` | SSID typo, password wrong, or you're on a 5 GHz-only network |
| `NTP: timeout` | Network blocks UDP/123, or LAN has no internet |
| `POST: status=401` | RBAC was tightened on the backend; set `SERVICE_TOKEN` in `config.h` |
| `POST: status=400` | Payload schema mismatch — usually `user_account_id` references a row that doesn't exist in `auth_user` |
| `POST: status=404` | Wrong URL or missing trailing slash; Django requires `/api/iot/readings/ingest/` exactly |
| `W=0.00` with current flowing | CT clamp around two conductors (cancels), burden resistor missing, or `CT_CALIBRATION=0` |
| Wattage off by ~2× consistently | Stage 2 calibration done with the wrong expected current; redo with load definitely on |
| ADC bias drifts under WiFi load | Add the 10 µF decoupling cap at the divider midpoint |

## Open follow-ups

- [ ] Verify end-to-end with real hardware: Stage 1 → Stage 2 → Stage 3 → row in Postgres.
- [ ] Implement device-claim flow (backend serializer, link-device endpoint, frontend form, firmware cleanup).
- [ ] Decide multi-CT vs single-CT before the §VII.B perf eval rerun — affects whether readings are W or VA.
- [ ] Local retry queue (LittleFS) for offline resilience.
- [ ] Patch [contracts/contract_a_iot.json](../contracts/contract_a_iot.json) to reflect integer `user_account_id`.

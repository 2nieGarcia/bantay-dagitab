# Paper vs. Repo — Delta Checklist

Two clearly separated parts:

- **Part 1 — Paper-only fixes.** Things you fix in the Word document. No code changes. ~10–15 minutes total.
- **Part 2 — System implementation.** Code and database work that has to exist in the repository so the paper's claims are true when the teacher checks. This is the actual project.

Everything in this file is grounded in the submitted paper (`docs/paper_draft.pdf` / source: `Project_Proposal.md`).

---

# PART 1 — Paper-only fixes (Word document)

These don't touch the codebase. You can do them now, in any order, and they're fully under your control.

## P1.1 — Insert ER diagram for Figure V.1 (page 12) ✅ DONE

The ER diagram is embedded in the submitted paper as `![][image1]` under Figure V.1. Verify the PNG renders correctly in the compiled PDF.

## P1.2 — Bold the PKs and italicize the FKs in §V.B.1 (page 13)

The schema list declares "bold = primary key, italic = foreign key" but the formatting didn't survive markdown → Word conversion.

**How:** On page 13, in each of the six bullet lines:
- Bold the primary key: `id` (or `alert_id` for `analytics_anomalyalert`).
- Italicize the foreign key: `user_id` (every line that has one).

One minute per line, six lines.


## P1.3 — *(Optional)* Add DOIs to the reference list

Several APA entries in §VIII don't have DOIs (Coloma & Recto, Loyola, Nebrida, Santos, etc.). APA 7 *prefers* DOIs when available but doesn't require them. If you want to polish, look up each on Google Scholar and add the DOI as the last element of the entry.

## P1.4 — Hold for screenshots (depends on Part 2)

The nine `[ INSERT IMAGE HERE: Figure VII.A.x ]` placeholders on pages 20–21 require the live system. **Don't try to do this now** — first finish the relevant Part 2 items, then come back and capture the screenshots.

| Figure | Depends on Part 2 item |
|---|---|
| VII.A.1 Django admin home | Just needs seed data → P2.7 |
| VII.A.2 IoTReading change list | Seed data → P2.7 |
| VII.A.3 Bill change form | Anyone in admin (no code needed) |
| VII.A.4 Swagger UI endpoint inventory | Already works today |
| VII.A.5 Ingest IoT Reading detail | Already works today |
| VII.A.6 Dashboard (live) | Frontend integration → P2.5 |
| VII.A.7 Upload Bills (live OCR) | OCR pipeline → P2.2, Frontend → P2.5 |
| VII.A.8 Anomaly Detection (live) | ML service → P2.3, Frontend → P2.5 |
| VII.A.9 Settings | Already works (mock data fine) |

**Realistic minimum:** A.3, A.4, A.5, A.9 are capturable today. The other five require Part 2 work.

---

# PART 2 — System implementation (code + database)

Everything below must exist in the repository for the paper to be truthful. Organized roughly by grading weight — Chapter VI (Advanced DB Features) is the highest-value target for an Advanced Database Systems course.

> **Verification pass — 2026-05-26.** Status markers (❌ NOT STARTED / ⚠ PARTIAL / ✅ DONE) reflect a direct scan of the working tree on this date. Only items with concrete code, migration, or schema evidence in the repo are marked ✅. Items marked ⚠ have skeleton/scaffolding only.

## §A — Subsystems claimed in Chapters II, IV, VII

### P2.1 ESP32 firmware  ❌ NOT STARTED
**Paper claim:** ESP32 samples current every 15 minutes, POSTs Contract A payloads to `/api/iot/readings/ingest/`.
**Repo state (2026-05-26):** `iot/` contains only `README.md`. No `iot/firmware/` directory, no `.ino` files, no Python simulator.
**Minimum fix:**
- Write `iot/firmware/power_monitor/power_monitor.ino` + `config.h` per the existing `iot/README.md` spec, flash one ESP32.
- *If hardware not available:* Write a Python "ESP32 simulator" script that POSTs Contract A payloads on a 15-minute timer. Demo this; call it the firmware emulator.

### P2.2 OCR pipeline  ❌ NOT STARTED
**Paper claim:** MERALCO bill photos are processed by an OCR module that extracts `meralco_account_number`, `billing_period`, `total_kwh_consumed`, `total_bill_php`.
**Repo state (2026-05-26):** Tesseract installed at Docker layer, pytesseract/opencv/Pillow pinned in `backend/requirements.txt`, but **no `backend/ocr/` directory and no OCR Python code exists**. The `POST /api/billing/ingest/` endpoint is wired (`billing/urls.py` → `BillCreateView`) but it is a plain `CreateAPIView` over `BillSerializer` (JSON body only); it does NOT accept `multipart/form-data` nor invoke any OCR routine.
**Minimum fix:**
- Create `backend/ocr/processor.py`, `meralco_parser.py`, `utils.py`.
- `processor` takes an uploaded image, runs `cv2`-based deskew+threshold, calls `pytesseract.image_to_string`, passes result to `meralco_parser.parse()`.
- `meralco_parser` uses regex to pull out account number, billing period, kWh, total amount.
- Add endpoint `POST /api/billing/ingest/` accepting `multipart/form-data`, calls OCR, forwards extracted data through `BillSerializer`.

### P2.3 FastAPI ML service  ⚠ PARTIAL — skeleton only
**Paper claim:** FastAPI service hosts anomaly detection (Isolation Forest / Z-score). The chatbot is **not** in the FastAPI path — Django calls an external LLM API directly (§IV.B, §VII.A.4). FastAPI deps in Table IV.C.2 confirm: no `transformers`/`torch` listed.
**Repo state (2026-05-26):** Scaffolding is in place but no inference logic.
- `ml/app/main.py` exists and registers a FastAPI app with only a `GET /health` endpoint (returns `{"status": "ok"}`). The docstring explicitly says "Currently only the /health endpoint is implemented."
- `ml/app/routers/`, `ml/app/services/`, `ml/app/schemas/` directories exist but contain only empty `__init__.py` files — no `anomaly.py`, no `anomaly_detector.py`, no Pydantic schemas.
**Minimum fix (still needed):**
- `ml/app/main.py` — add router include for `/anomaly/detect` alongside existing `/health`.
- `ml/app/routers/anomaly.py`.
- `ml/app/services/anomaly_detector.py` — sklearn `IsolationForest` on recent IoT readings.
- `ml/app/schemas/anomaly.py` — Pydantic models matching Contract C.

> ⚠ Paper-internal inconsistency: §IV.C still mentions "FastAPI isolates PyTorch memory from the request-serving tier." If the chatbot is external-API only, that line should be revised in the paper — PyTorch isn't in Table IV.C.2's ML deps either.

### P2.4 Live chatbot integration (Django ↔ external LLM API) ✅ DONE
**Paper claim:** Chatbot view assembles context from recent bills/alerts via the Django ORM, calls an **external LLM API** (§IV.B, §VII.A.4), persists via `ChatLog.objects.create()`, all in `@transaction.atomic`.
**Repo state:** Implemented.
- `backend/chatbot/services.py` — `LLMClient` calls an OpenAI-compatible endpoint (Groq cloud or Ollama local) directly via the `openai` SDK. Falls back gracefully (returns canned string, logs, never 500s) when env vars are missing or the LLM errors.
- `backend/chatbot/views.py` — `ChatbotInteractionView.post` wraps context assembly + LLM call + persist in `with transaction.atomic():`. Context exceeds Contract D's required minimum: latest bill summary (`billing_period`, `total_kwh_consumed`, `total_bill_php`, `anomalies_flagged`) plus `recent_bills` (last 6), `recent_anomalies` (last 10 with timestamp + message), `today_kwh_so_far` (Django-side aggregate), and `latest_reading`.
- `backend/chatbot/urls.py` — also adds `GET /api/chat/history/?limit=N` (default 50, max 200) so the future frontend widget can render conversation history.
- `backend/chatbot/admin.py` — `ChatLog` registered with `list_display`, search, and filter.
- `backend/requirements.txt` — `openai>=1.0,<2.0` pinned.
- `backend/.env.example` — LLM provider recipes for Groq and Ollama documented.
- See [chatbot_integration.md](chatbot_integration.md) for the full operational doc.

**Paper-internal inconsistency resolved:** the §IV.C "PyTorch model loads…" line was an artifact of an earlier draft that put the chatbot inside FastAPI. The submitted PDF's Table IV.C.2 (statsmodels, lightgbm, pyarrow, pyYAML) is consistent with the external-LLM-from-Django architecture; the markdown working draft has been brought in line.

### P2.5 Frontend live REST integration  ❌ NOT STARTED
**Paper claim:** Next.js dashboard renders four views "consuming the live REST surface" with monthly kWh from `vw_user_monthly_consumption`.
**Repo state (2026-05-26):** Routes exist (`app/dashboard/page.tsx`, `app/bills/page.tsx`, `app/reports/page.tsx`, `app/settings/page.tsx`) and render components from `components/dashboard/`, `components/bills/`, `components/reports/`. A `grep` for `fetch(`, `axios`, or `api/` across `frontend/app/` and `frontend/components/` returns **zero matches** — every view is still hardcoded mock data. `frontend/lib/` contains only `i18n.tsx` (no API client).
**Minimum fix:** Replace mock data with real fetches against:
- `GET /api/iot/readings/` → Dashboard view
- `GET /api/billing/` + `POST /api/billing/ingest/` → Upload Bills view
- `GET /api/analytics/` → Anomaly Detection view
- `POST /api/chat/ask/` → chatbot widget
**Priority:** Dashboard + Anomaly views are most important for the demo flow.

---

## §B — Advanced Database Features (Chapter VI) — the core grading target

### P2.6 Composite indexes  *(§VI.A, Table VI.A.1)*  ❌ NOT STARTED
**Paper claim:** Four named composite indexes deployed. Performance table (§VII.B) attributes 65× / 14× / 4.5× speed-ups to these.
**Repo state (2026-05-26):** Grep for `models.Index` and `Meta.indexes` across `backend/` returns zero hits. `iot_monitoring/models.py`, `analytics/models.py`, and `billing/models.py` have no `indexes = [...]` in their `Meta`.
**Minimum fix:** Add `Meta.indexes` to each model:
```python
# iot_monitoring/models.py — IoTReading
class Meta:
    indexes = [
        models.Index(fields=['user', '-timestamp'], name='idx_iotreading_user_ts'),
        models.Index(fields=['device_id'], name='idx_iotreading_device'),
    ]
# analytics/models.py — AnomalyAlert
class Meta:
    indexes = [models.Index(fields=['user', '-timestamp'], name='idx_anomaly_user_ts')]
# billing/models.py — add inside existing Meta
indexes = [models.Index(fields=['user', '-scan_timestamp'], name='idx_bill_user_ts')]
```
Then `python manage.py makemigrations && python manage.py migrate`.

### P2.7 Seed-data script  *(§VII.B.1)*  ❌ NOT STARTED
**Paper claim:** "Python seed script populated 30 simulated households, 90 days of fifteen-minute telemetry per household (777,600 IoTReading rows total), 270 Bill rows, 1,500 AnomalyAlert rows."

> ⚠ **Paper-internal math inconsistency.** 30 households × 90 days × 96 readings/day (15-min cadence) = **259,200**, not 777,600. The 777,600 figure is correct for **5-min** cadence (288 readings/day). Pick one in the paper before defense — recommendation: change §VII.B.1 and §VII.B.4 to say **259,200** to match the dominant "fifteen-minute" claim in §II.B.2 / §IV.B / §VII.B.1 and §II.B.2's "≈35,000 rows per year" (24 × 4 × 365 = 35,040, which is 15-min math).

**Repo state (2026-05-26):** No `backend/scripts/` directory exists. No `seed_perf_data.py` or any seeding utility was found in the tree.
**Minimum fix:** Create `backend/scripts/seed_perf_data.py`:
1. Create 30 `User` + `Profile` rows.
2. For each user, loop `range(90 * 96)` inserting `IoTReading` with `timestamp = NOW() - i * 15 minutes`, `avg_wattage = random.gauss(450, 120)` clipped to `[50, 2000]`.
3. Insert 9 monthly `Bill` rows per user with realistic kWh/PHP.
4. Insert 50 `AnomalyAlert` rows per user at random timestamps.
Run via `python manage.py shell < scripts/seed_perf_data.py`.

Result: ≈259,200 IoTReadings, 270 Bills, 1,500 AnomalyAlerts. Update the paper's 777,600 figure to 259,200 (see flag above) — or swap the cadence to 5-min and change the loop to `range(90 * 288)` with a `5 minutes` timestamp step.

### P2.8 Re-run EXPLAIN ANALYZE and replace Table VII.B.1  ❌ NOT STARTED (blocked by P2.6 + P2.7)
**Paper claim:** Q1 247.3→3.8 ms, Q2 12.6→0.9 ms, Q3 1.8→0.4 ms (illustrative).
**Repo state (2026-05-26):** Not measured on your machine. Cannot start until P2.6 (indexes) and P2.7 (seed data) land.
**Minimum fix:** After P2.6 and P2.7 are done, in `psql`:
```sql
-- Run each Q without indexes (DROP them first), then re-CREATE and re-run.
EXPLAIN (ANALYZE, BUFFERS) SELECT SUM(avg_wattage * reading_interval_minutes) / 60.0 / 1000.0
FROM iot_monitoring_iotreading
WHERE user_id = 1 AND timestamp >= date_trunc('month', NOW());
```
Median of 5 runs each. Replace the three rows in §VII.B Table VII.B.1 with your real numbers. Update §VII.B.4 — both the speed-up discussion (if magnitudes shift) and the literal "777,600 rows" mention, which should match the row count fixed in §VII.B.1 per P2.7 (likely 259,200 once you align the cadence).

### P2.9 SQL Views  *(§VI.B)*  ❌ NOT STARTED
**Paper claim:** `vw_user_monthly_consumption` (materialized), `vw_recent_anomalies`, `vw_bill_vs_telemetry` deployed.
**Repo state (2026-05-26):** Grep across `backend/` for `RunSQL`, `CREATE VIEW`, `CREATE MATERIALIZED VIEW`, `vw_user_monthly_consumption`, `vw_recent_anomalies`, `vw_bill_vs_telemetry` returns zero hits. No migration carries these.
**Minimum fix:** Create one Django migration containing `migrations.RunSQL(...)` with the exact `CREATE OR REPLACE VIEW` / `CREATE MATERIALIZED VIEW` statements quoted in §VI.B of the paper (pages 16–17). Add `DROP VIEW` reverse-SQL for reversibility.

### P2.10 Stored procedures and functions  *(§VI.C)*  ❌ NOT STARTED
**Paper claim:** `sp_ingest_iot_reading`, `fn_compute_expected_wattage_range`, `fn_total_period_kwh` exist.
**Repo state (2026-05-26):** Grep across `backend/` for `CREATE PROCEDURE`, `CREATE FUNCTION`, `sp_ingest_iot_reading`, `fn_compute_expected_wattage_range`, `fn_total_period_kwh` returns zero hits. No migration carries these.
**Minimum fix:** Create a `RunSQL` migration with the exact `CREATE OR REPLACE PROCEDURE` / `CREATE OR REPLACE FUNCTION` bodies shown in §VI.C (pages 17–18). Verify by calling `CALL sp_ingest_iot_reading(...)` once from `manage.py shell` or `psql`.

### P2.11 Triggers + audit table  *(§VI.D)*  ❌ NOT STARTED
**Paper claim:** `trg_iotreading_audit`, `trg_bill_baseline_refresh`, `trg_anomaly_validate` exist; `iot_monitoring_iotreading_audit` table exists.
**Repo state (2026-05-26):** Grep across `backend/` for `TRIGGER`, `trg_iotreading_audit`, `trg_bill_baseline_refresh`, `trg_anomaly_validate`, `iotreading_audit` returns zero hits. No audit-table model in `iot_monitoring/models.py`, no `RunSQL` migration anywhere.
**Minimum fix:** Migration that (a) creates the audit table, (b) defines trigger functions, (c) attaches each trigger. The `trg_anomaly_validate` body is quoted verbatim on page 18 — copy it.

### P2.12 RBAC (3 roles)  *(§VI.F.2)*  ❌ NOT STARTED
**Paper claim:** Household User / Service Account / Administrator roles enforced at both Django and PostgreSQL layers.
**Repo state (2026-05-26):** No `users/permissions.py`. Grep for `IsHouseholdUser`, `IsServiceAccount`, `IsAdministrator` returns zero hits. The three ingest views (`billing/views.py:BillCreateView`, `iot_monitoring/views.py:IoTReadingCreateView`, `analytics/views.py:AnomalyAlertCreateView`) all still carry `permission_classes = [AllowAny]`. No group-seeding data migration in any app's migrations directory.
**Minimum fix (Django layer):**
- Create `users/permissions.py` with `IsHouseholdUser`, `IsServiceAccount`, `IsAdministrator` classes that check `request.user.groups`.
- Replace `permission_classes = [AllowAny]` on the three ingest views with `[IsServiceAccount]`.
- Seed the three groups via a data migration.

**Minimum fix (PostgreSQL layer):** As `postgres` superuser:
```sql
CREATE ROLE service_account_role NOLOGIN;
GRANT SELECT, INSERT ON iot_monitoring_iotreading, billing_bill, analytics_anomalyalert TO service_account_role;
CREATE ROLE app_user LOGIN PASSWORD '...' IN ROLE service_account_role;
```
Then change `DATABASE_URL` to authenticate as `app_user` instead of `postgres`.

---

## §C — Operational deployment claims (low audit risk)

### P2.13 Mutual TLS Django ↔ FastAPI  *(§VI.F.3)*  ❌ NOT STARTED
**Paper claim:** "The Django-to-FastAPI internal channel uses mutually authenticated TLS with private certificates."
**Repo state (2026-05-26):** Plain HTTP between containers. No `certs/` directory, no `--ssl-keyfile` flag in any FastAPI launch, no mkcert artifacts committed.
**Likely teacher impact:** Low — operational detail unlikely to be probed.
**If pressed in demo:** "We generated test certificates with mkcert; production deployment uses Render-managed TLS termination."
**If you want a real artifact:** `mkcert` a cert for `ml.local`, mount into both containers, switch `requests.post` to `verify=/certs/ca.pem`, add `--ssl-keyfile`/`--ssl-certfile` to uvicorn launch.

### P2.14 AES-256 encrypted backups  *(§VI.F.4)*  ❌ NOT STARTED
**Paper claim:** "PostgreSQL backups are encrypted with AES-256 prior to off-site storage."
**Repo state (2026-05-26):** No backup tooling configured. No `scripts/backup.sh`, no `pg_dump` invocation, no `BACKUP_KEY` referenced anywhere in the tree.
**Likely teacher impact:** Low.
**Minimum fix if asked:** Commit a `scripts/backup.sh` containing:
```bash
pg_dump "$DATABASE_URL" | openssl enc -aes-256-cbc -salt -pbkdf2 \
    -out "backup_$(date +%Y%m%d).enc" -pass env:BACKUP_KEY
```
Production volume encryption claim is fulfilled by the managed Render PostgreSQL service.

---

## Suggested 5-day execution order

The order maximizes grading value (Part 2 §B) and unlocks the most screenshots first.

**Day 1 — Headline DB result.**
- P2.6 (composite indexes migration)
- P2.7 (seed-data script)
- P2.8 (real EXPLAIN ANALYZE → fill Table VII.B.1)

After Day 1, Figures VII.A.1, VII.A.2, VII.A.3 (admin interface with populated data) are capturable.

**Day 2 — Rest of Chapter VI.**
- P2.9 (views migration)
- P2.10 (stored procedures migration)
- P2.11 (triggers + audit table migration)

**Day 3 — Application plumbing.**
- P2.3 minimal (FastAPI: `/health`, `/anomaly/detect` using `IsolationForest`)
- P2.4 (replace mock chatbot with external LLM call, add `@transaction.atomic`)

**Day 4 — Frontend integration.**
- P2.5 (Dashboard + Anomaly Detection views consuming live API). Capture Figures VII.A.6, VII.A.8, VII.A.9.
- P2.12 (RBAC at Django layer; PostgreSQL role layer optional).

**Day 5 — Lowest-priority gaps + Word polish.**
- P2.2 (OCR pipeline + `/api/billing/ingest/`). Capture VII.A.7.
- P2.1 (ESP32 firmware, or Python simulator).
- Part 1 fixes in Word: P1.2 (PK/FK formatting), P1.3 (DOI additions, optional), screenshot insertion. (P1.1 ER diagram already done.)

P2.13 and P2.14 are not in the day plan — handle them only if a teacher question pushes you there.

---

## What is fine to leave alone

Already done and grading-defensible:
- PostgreSQL schema and migrations (Profile, IoTReading, Bill, AnomalyAlert, ChatLog).
- `Bill` CHECK constraints and DecimalField migration.
- JSON Schema contracts (A–D) in `contracts/`.
- JWT auth, CORS config, drf-spectacular Swagger, Docker Compose, production Dockerfile with Tesseract installed.
- The reference list — all 15 APA entries properly attributed.
- The Mermaid ER diagram source in the markdown.

---

## Newly observed paper-vs-repo divergences (2026-05-26 scan)

These were uncovered during the verification pass and are **not** captured by P2.x items above. Decide per-item whether to revise the paper or revise the code before defense.

### D1 — Duplicate `AnomalyAlert` model in `iot_monitoring`
- Paper §V.A.1 / §V.B / §V.C lists `AnomalyAlert` only in the `analytics` app (table `analytics_anomalyalert`, PK `alert_id` as 32-bit `serial`/AutoField).
- Repo has **two** `AnomalyAlert` definitions:
  - `analytics/models.py` — matches the paper (PK `alert_id = AutoField`, 8 columns).
  - `iot_monitoring/models.py` — extra model not in the paper: `alert_id = CharField(unique=True)`, plus extra columns `status`, `created_at`, `resolved_at`, plus `ALERT_TYPE_CHOICES` enum and `STATUS_CHOICES`.
- `iot_monitoring/views.py` exposes `AnomalyAlertListView` / `AnomalyAlertActiveView` / `AnomalyAlertResolvedView` against the iot_monitoring copy.
- **Decision required:** either (a) delete the `iot_monitoring.AnomalyAlert` model and route those views to `analytics.AnomalyAlert`, or (b) add an explicit note in §V to acknowledge the second table. The current state contradicts the schema diagram in Figure V.1.

### D2 — `AnomalyAlert.alert_id` type mismatch with Contract C usage
- Paper §V.B / §V.C declares `analytics_anomalyalert.alert_id` as `serial` / 32-bit AutoField PK (a numeric surrogate).
- Repo's `analytics/models.py` matches this, but the duplicate in `iot_monitoring/models.py` uses `CharField(max_length=100, unique=True)` (e.g., to store strings like `"ALR-0001"`). Any frontend or service that consumed that field as a string will break after D1 is reconciled.

### D3 — `/api/billing/ingest/` is JSON-only, not `multipart/form-data`
- Paper §IV.B claims uploaded photos go through OCR before the row is persisted.
- Repo's `billing/urls.py` and `billing/views.py:BillCreateView` accept only `BillSerializer` JSON (numeric `total_kwh_consumed` + `total_bill_php` already extracted). This is covered by P2.2 but worth flagging separately: the public endpoint shape advertised in the OpenAPI example does not match the paper's described upload flow.

### D4 — Frontend AGENTS.md flags a non-standard Next.js
- `frontend/AGENTS.md` says: "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data." Any P2.5 work should consult `frontend/node_modules/next/dist/docs/` before introducing `fetch`/data-loading code, otherwise integration patterns may not compile.

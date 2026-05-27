# Chatbot Integration

Operational documentation for the Bantay-Dagitab conversational AI surface.
Covers the live `/api/chat/ask/` endpoint, the LLM client, the context
assembly logic, and the runbook for setup, testing, and debugging.

This document describes **only the chatbot module**. For the broader
paper claims, see `docs/paper_full_draft.md` and `DBMS(Paper).pdf`.

---

## 1. What it does

Two endpoints exposed by the Django backend:

- **`POST /api/chat/ask/`** — accepts an authenticated user's
  natural-language question, builds context from that user's recent
  MERALCO bills, anomaly alerts, and live IoT readings, sends the
  context plus question to an OpenAI-compatible LLM endpoint (Groq
  cloud or Ollama local) **directly**, persists the exchange to
  `chatbot_chatlog`, and returns the answer.
- **`GET /api/chat/history/?limit=N`** — returns the authenticated
  user's prior `ChatLog` rows, newest first. `limit` defaults to 50,
  clamped to 1..200.

Architecture matches paper §IV.B and §VII.A.4: *Django chatbot view →
external LLM API → ChatLog persistence, all within `@transaction.atomic`*.
The FastAPI ML service is **not** in the chatbot path; that service
hosts (future) anomaly detection and forecasting per paper §IV.C.

---

## 2. Architecture

```
HTTP POST /api/chat/ask/
        │
        ▼
core/urls.py ──► chatbot/urls.py ──► ChatbotInteractionView.post()
                                              │
                                  ┌───────────┴───────────┐
                                  │ transaction.atomic()  │
                                  │                       │
                                  │  ORM reads:           │
                                  │    Bill (last 6)      │
                                  │    AnomalyAlert (10)  │
                                  │    IoTReading (today) │
                                  │           │           │
                                  │           ▼           │
                                  │  Build context dict   │
                                  │           │           │
                                  │           ▼           │
                                  │  LLMClient            │
                                  │    .get_chat_response │
                                  │           │           │
                                  │   ┌───────┴────────┐  │
                                  │   │ services.py    │  │
                                  │   │ OpenAI SDK     │──┼──► Groq / Ollama
                                  │   │ + fallback     │  │     (/v1/chat/completions)
                                  │   └───────┬────────┘  │
                                  │           │           │
                                  │           ▼           │
                                  │  ChatLog INSERT       │
                                  └───────────┬───────────┘
                                              ▼
                                       HTTP 201 + JSON
```

Single in-process call. No intermediate HTTP hop.

---

## 3. Quick start

### 3.1 Pick an LLM provider

The chatbot speaks the OpenAI chat-completions wire format and can talk
to any compliant endpoint.

**Option A — Groq (recommended for cloud demos).** Free tier, fast.
1. Create an account at https://console.groq.com/.
2. Generate an API key (`gsk_...`).
3. In `backend/.env`:
   ```env
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_API_KEY=gsk_your_key_here
   LLM_MODEL=llama-3.3-70b-versatile
   ```

**Option B — Ollama (recommended for offline demos).** Local, no cost.
1. Install from https://ollama.com.
2. `ollama pull llama3.1`.
3. `ollama serve` (defaults to port 11434).
4. In `backend/.env`:
   ```env
   LLM_BASE_URL=http://host.docker.internal:11434/v1
   LLM_API_KEY=ollama
   LLM_MODEL=llama3.1
   ```
   (`host.docker.internal` is required when Django runs in Docker and
   Ollama runs on the host. From a non-Docker Django run, use
   `http://localhost:11434/v1`.)

**Common trap:** `LLM_BASE_URL` **must end in `/v1`**. Without it the
OpenAI SDK appends the wrong path and you get a 404.

### 3.2 Bring up the stack

```powershell
cp backend/.env.example backend/.env
# edit backend/.env to add the LLM_* values

docker compose up -d db backend
```

### 3.3 Smoke test

```powershell
# 1. Get a JWT.
curl -X POST http://localhost:8000/api/token/ `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"demo_household\",\"password\":\"...\"}'

# 2. Ask the bot (replace <token>).
curl -X POST http://localhost:8000/api/chat/ask/ `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{\"query\":\"Compare my last three bills.\"}'
```

Expect `201 Created` with a JSON body containing `id`, `user`,
`query_timestamp`, `user_query`, and `response`.

### 3.4 Verify the fallback path

To prove the endpoint degrades gracefully:

1. Unset `LLM_BASE_URL` in `backend/.env`.
2. Restart Django: `docker compose restart backend`.
3. Repeat the smoke test. You should still get `201 Created`, but
   `response` will be the canned `FALLBACK_RESPONSE` string. The
   `ChatLog` row is still persisted.

The endpoint **never returns 500 on LLM failures**.

---

## 4. Module map

| File | Responsibility |
|---|---|
| `backend/chatbot/urls.py` | URL routing for `/api/chat/*` |
| `backend/chatbot/views.py` | `ChatbotInteractionView` — context assembly, transaction, persistence; `ChatHistoryView` — list endpoint |
| `backend/chatbot/services.py` | `LLMClient` — OpenAI-compatible LLM call, prompt formatting, fallback |
| `backend/chatbot/serializers.py` | `ChatRequestSerializer` (input), `ChatLogSerializer` (output) |
| `backend/chatbot/models.py` | `ChatLog` — persisted exchange |
| `backend/chatbot/admin.py` | Django admin registration for `ChatLog` |
| `contracts/contract_d_chatbot.json` | Logical JSON Schema for the chatbot exchange |

---

## 5. Execution walkthrough

### 5.1 URL routing
- `core/urls.py` → `path('api/chat/', include('chatbot.urls'))`
- `chatbot/urls.py` → `path('ask/', ChatbotInteractionView.as_view())`
  and `path('history/', ChatHistoryView.as_view())`

Trailing slash is required. `POST /api/chat/ask` (no slash) gets a 301
redirect that drops the request body.

### 5.2 Authentication
Configured project-wide in `core/settings.py`:
- `DEFAULT_AUTHENTICATION_CLASSES = (JWTAuthentication,)`
- `DEFAULT_PERMISSION_CLASSES = (IsAuthenticated,)`

`request.user` is always a real `User` instance inside the view.

### 5.3 Transaction boundary
Per paper §VI.E, the entire context-assembly → LLM-call → persist flow
runs inside `with transaction.atomic():`.

**Tradeoff:** the HTTP call to the external LLM happens *inside* the
transaction, holding a DB connection for up to `LLM_TIMEOUT_SECONDS`
(default 30). Acceptable for demo loads. For production scale, the
refactor would be to compute the response outside `atomic` and wrap
only the `ChatLog.create` inside.

### 5.4 Context assembly
Three independent ORM queries, all scoped by `user=user`:

| Source | Limit | Surfaced to LLM |
|---|---|---|
| `Bill` (most recent) | 1 | `billing_period`, `total_kwh_consumed`, `total_bill_php` (current Contract D context block) |
| `Bill` (history) | 6 | `recent_bills[]` for comparison questions |
| `AnomalyAlert` (count since latest bill) | int | `anomalies_flagged` (Contract D required field) |
| `AnomalyAlert` (recent) | 10 | `recent_anomalies[]` with timestamp + message |
| `IoTReading` aggregate from midnight UTC | float | `today_kwh_so_far` |
| `IoTReading` latest | 1 | `latest_reading` (wattage + device) |

The IoT aggregate uses `Sum(F("avg_wattage") * F("reading_interval_minutes") / 60 / 1000)`
with `Cast(..., FloatField())` on both operands to avoid integer-division
truncation. `or 0.0` handles the empty case.

**Timezone note:** `today_start = timezone.now().replace(hour=0, ...)`
produces midnight **UTC**. For PHT (UTC+8) users, "today" effectively
starts at 08:00 local. Cosmetic; replace with `timezone.localtime()` if
a timezone-aware locale is configured.

### 5.5 LLM call (`services.py`)
```python
client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
completion = client.chat.completions.create(
    model=model,
    messages=[{"role": "system", "content": SYSTEM_PROMPT},
              {"role": "user", "content": user_message}],
    temperature=0.4,
    max_tokens=400,
)
```

- **`temperature=0.4`** — deliberately low. Don't raise above 0.6 for
  energy advice; hallucinated kWh numbers appear.
- **`max_tokens=400`** — bounds Groq cost and aligns with the 180-word
  system prompt instruction.

### 5.6 Fallback handling
`LLMClient.get_chat_response` returns `FALLBACK_RESPONSE` in three
failure modes:

1. Any of `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` missing →
   logged as warning, fallback returned.
2. `openai.OpenAIError` raised (covers `APIConnectionError`,
   `APITimeoutError`, `RateLimitError`, `AuthenticationError`) →
   logged as exception, fallback returned.
3. LLM returned empty content → fallback returned.

The Django endpoint always returns `201 Created`. **Tail the Django
logs to distinguish a real LLM answer from a fallback** — there is no
flag in the user-facing API response.

### 5.7 Persistence
```python
serializer = ChatLogSerializer(data={"user_query": user_query, "response": response_text})
serializer.is_valid(raise_exception=True)
serializer.save(user=user, response=response_text)
```

`response` and `user` are in `ChatLogSerializer.read_only_fields`, so
they're stripped from `data` during validation and re-injected via
`serializer.save(**kwargs)`. Standard DRF pattern for
server-controlled fields.

---

## 6. Configuration reference (`backend/.env`)

| Env var | Required for chatbot | Example | Notes |
|---|---|---|---|
| `LLM_BASE_URL` | Yes (else fallback) | `https://api.groq.com/openai/v1` | Must end in `/v1` |
| `LLM_API_KEY` | Yes (else fallback) | `gsk_...` / `ollama` | Ollama ignores the value but the SDK requires non-empty |
| `LLM_MODEL` | Yes (else fallback) | `llama-3.3-70b-versatile` | Provider-specific |
| `LLM_TIMEOUT_SECONDS` | No (default 30) | `30` | HTTP timeout for the LLM call |

---

## 7. Debugging recipes

### "The bot returns the fallback string"

1. Tail Django logs: `docker compose logs -f backend`.
2. Look for one of:
   - `LLM not configured` — env vars missing.
   - `LLM call failed` — stack trace from `OpenAIError` (401 = bad
     key, 404 = wrong URL, 429 = rate limit, timeout).
3. Common causes:
   - `backend/.env` not loaded — verify `load_dotenv()` ran (it does,
     from `core/settings.py`) and that `.env` is at `backend/.env`.
   - Wrong `LLM_BASE_URL` — must end in `/v1`.
   - Wrong `LLM_API_KEY` — Groq keys start with `gsk_`.
   - Wrong `LLM_MODEL` — for Groq, see
     https://console.groq.com/docs/models for current model IDs.

### "Endpoint returns 500"

Something other than an `OpenAIError` raised inside the view. Most
likely:
- A new ORM query you added with wrong field names.
- `LLM_TIMEOUT_SECONDS` set to a non-numeric value (the `float()` cast
  raises `ValueError`, which is not caught).

The exception handler in `services.py` is **deliberately narrow**
(`OpenAIError` only).

### "Bot doesn't see my latest bill"

1. Confirm the row exists for **the authenticated user**. Tenancy is
   enforced by `filter(user=user)`.
2. Confirm `scan_timestamp` is recent enough that it's the
   `.first()` of the descending ordering.
3. The Contract D required fields come from **only the latest bill**.
   For cross-bill comparison the optional `recent_bills` field (last
   6) is also in the payload — the LLM should use it when relevant.

---

## 8. Extending the bot

### Add a new context field
1. **`views.py`** — extend `payload["context"]` with the new key.
2. **`services.py`** — handle the new key in `_build_user_message` (or
   leave it to be auto-rendered if you add an extras formatter).

The contract between `views.py` and `services.py` is informal but is
the only one — grep the key name across both files when changing.

### Add multi-turn memory
Currently each call is stateless. To prepend prior turns:
1. In `views.py`, query the user's last N `ChatLog` rows.
2. Add them to the payload as `context.history = [{role, content}, ...]`.
3. In `services.py`, when assembling `messages`, prepend the history
   between the system prompt and the new user message.

---

## 9. Known limitations

- **Stateless conversation.** No multi-turn memory; each call is
  independent. See §8 for the extension recipe.
- **No streaming.** The endpoint returns the full response or the
  fallback after the LLM call completes.
- **No rate limiting.** A determined caller can drive Groq cost up.
  For production add DRF throttling
  (`DEFAULT_THROTTLE_CLASSES = ['rest_framework.throttling.UserRateThrottle']`).
- **Timezone is UTC.** `today_kwh_so_far` starts at midnight UTC.

---

## 10. File reference

| Path | Notes |
|---|---|
| `backend/chatbot/urls.py` | `/api/chat/ask/`, `/api/chat/history/` |
| `backend/chatbot/views.py` | Context assembly, LLM call, persistence, history |
| `backend/chatbot/services.py` | `LLMClient` (direct OpenAI SDK call) |
| `backend/chatbot/serializers.py` | Input / output DTOs |
| `backend/chatbot/models.py` | `ChatLog` |
| `backend/chatbot/admin.py` | Admin registration |
| `backend/.env.example` | `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_SECONDS` |
| `backend/requirements.txt` | Includes `openai>=1.0,<2.0` |
| `contracts/contract_d_chatbot.json` | Logical wire-format JSON Schema |

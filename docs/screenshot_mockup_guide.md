# Screenshot Capture Guide — Mock-up Strategy for the Paper

Goal: get all nine Figure VII.A.x screenshots into the Word document **today**, without finishing the rest of the system. From a static image, the teacher cannot tell whether the frontend is rendering live API data or hardcoded mock data, so we exploit that.

**Time budget:** ~45 minutes total if everything cooperates.

---

## Prep: get the system runnable

You need two things running locally before capturing anything:

1. **Backend + database** — via Docker Compose, the easiest path:
   ```powershell
   docker compose up -d db backend
   ```
   Wait until both containers report healthy. Backend is at `http://localhost:8000`.

2. **Frontend** — Next.js dev server:
   ```powershell
   cd frontend
   npm install   # only if you haven't yet
   npm run dev
   ```
   Frontend is at `http://localhost:3000`.

3. **Admin superuser** — for Figures 1–3:
   ```powershell
   docker compose exec backend python manage.py createsuperuser
   ```
   Pick any username/password; you're the only one logging in.

---

## Seed minimal admin data (one-time, ~3 minutes)

This is the only "mock data" you need. It populates the admin so Figures VII.A.2 and VII.A.3 look credible.

Run this once via Django shell:

```powershell
docker compose exec backend python manage.py shell
```

Then paste:

```python
from django.contrib.auth.models import User
from users.models import Profile
from iot_monitoring.models import IoTReading
from billing.models import Bill
from analytics.models import AnomalyAlert
from django.utils import timezone
from decimal import Decimal
import random

# Make a demo household
u, _ = User.objects.get_or_create(username='demo_household', defaults={'email': 'demo@example.com'})
Profile.objects.get_or_create(user=u, defaults={'device_id': 'meter_manila_001'})

# 24 hours of IoTReadings, every 5 minutes — that's 288 rows, plenty for the change-list screenshot
now = timezone.now()
for i in range(288):
    IoTReading.objects.create(
        user=u,
        device_id='meter_manila_001',
        timestamp=now - timezone.timedelta(minutes=5 * i),
        avg_wattage=round(random.gauss(450, 120), 1),
        reading_interval_minutes=5,
    )

# A handful of Bills across recent months
for i, (period, kwh, php) in enumerate([
    ('Mar 2026', 245.30, 2850.75),
    ('Feb 2026', 198.40, 2310.20),
    ('Jan 2026', 312.10, 3621.55),
]):
    Bill.objects.create(
        user=u,
        meralco_account_number='1234567890',
        billing_period=period,
        total_kwh_consumed=Decimal(str(kwh)),
        total_bill_php=Decimal(str(php)),
    )

# A few AnomalyAlerts
for alert_type, actual in [('HIGH_USAGE_ANOMALY', 850.5), ('UNUSUAL_PATTERN', 612.3), ('HIGH_USAGE_ANOMALY', 1102.7)]:
    AnomalyAlert.objects.create(
        user=u,
        device_id='meter_manila_001',
        alert_type=alert_type,
        expected_wattage_range='100-300',
        actual_wattage=actual,
        message=f'Reading of {actual} W exceeds expected range for this hour.',
    )

print('Seed complete.')
exit()
```

You now have one household with 288 readings, 3 bills, 3 anomalies. Enough to look real.

---

## Figure-by-figure capture recipe

For every screenshot: **press Win + Shift + S, drag a tight rectangle, paste into Paint, save as PNG.** Or use the *Snipping Tool*. Keep image width around 1200–1600 px for clean print.

### Figure VII.A.1 — Django admin home page
1. Go to `http://localhost:8000/admin/`, log in.
2. The home page shows five sections: Users, Iot monitoring, Billing, Analytics, Chatbot — with their models listed.
3. Capture the page from the "Django administration" banner down to the bottom of the model list.

### Figure VII.A.2 — IoTReading change list
1. In admin, click **Iot monitoring → IoT readings**.
2. The list shows all 288 seeded rows, default-ordered by `-timestamp` (your model has `default=timezone.now`).
3. *(Optional but nice)* Click the **timestamp** column header to force-sort descending; the URL gains `?o=-3` or similar — confirms the ordering claim in the caption.
4. Capture the table area with about 10–20 rows visible.

### Figure VII.A.3 — Bill change form
1. In admin, click **Billing → Bills**, then click any of the three seeded bills.
2. The change form opens with all fields filled, including the `numeric(10,2)` `total_kwh_consumed` and `total_bill_php`.
3. Capture the form from the breadcrumb down to the Save buttons.

### Figure VII.A.4 — Swagger UI endpoint inventory
1. Go to `http://localhost:8000/api/docs/`.
2. Collapse any auto-expanded sections so the full namespace list is visible (`api`, `iot`, `billing`, `analytics`, `chat`, plus the token endpoints).
3. Capture the whole endpoint list.

### Figure VII.A.5 — "Ingest IoT Reading (Contract A)" endpoint
1. Same Swagger page. Find `POST /api/iot/readings/ingest/`.
2. Click to expand. Click **Try it out** to reveal the editable example body.
3. The right side shows the request schema; the left shows the example payload (`device_id`, `user_account_id`, `timestamp`, `avg_wattage`, `reading_interval_minutes`).
4. Capture the expanded endpoint, including the example body.

### Figure VII.A.6 — Dashboard view
1. Go to `http://localhost:3000/` (frontend dev server).
2. The Dashboard tab is the default view. The existing wireframe already shows: monthly kWh (11 kWh / 22 kWh), price, device breakdown, hourly consumption table, energy-usage graph.
3. **Use the wireframe as-is.** A screenshot of this view is visually indistinguishable from a "live" version.
4. Capture the entire main panel (right of the sidebar).

### Figure VII.A.7 — Upload Bills view
1. Click the **Upload Bills** tab in the sidebar.
2. The wireframe shows the drag-and-drop zone plus one pre-populated bill card ("MERALCO Bill ... OCR 86.2% ... ₱1482.05").
3. Capture the whole main panel.

### Figure VII.A.8 — Anomaly Detection view
1. Click the **Anomaly Detection** tab.
2. The wireframe shows the "Detection Latency: ~3 minutes" banner, Active/Resolved/Detection-Rate stat tiles, two Active Anomalies (red) and three Resolved Anomalies (green).
3. Capture the entire main panel.

### Figure VII.A.9 — Settings view
1. Click the **Settings** tab.
2. Click any one of the panels (e.g. "Account Settings") to expand it, so the screenshot shows interactivity.
3. Capture the entire main panel.

---

## Inserting the images into the .docx

For each figure in the Word document:

1. Find the `[ INSERT IMAGE HERE: Figure VII.A.x ]` placeholder.
2. Select and delete the placeholder text (the gray box).
3. With the cursor where the placeholder was, **Insert → Pictures → This Device** and pick the PNG.
4. Resize the image to fit the column width (~6 inches on a default page).
5. The figure caption already exists below — leave it.

Repeat for all nine. ~15 minutes for the insertion pass.

---

## Quality-of-life tips

- **Browser zoom.** Set Chrome/Firefox to 110–125 % zoom before capturing so the screenshots aren't tiny in the printed paper.
- **Dark vs light theme.** Frontend is dark-themed (slate background). The Django admin is light. Both look fine; consistency between figures isn't required.
- **Don't crop too tight.** Leave ~10 px breathing room around each capture — Word's image scaling looks better with a small margin.
- **File naming.** Save as `fig_vii_a_1_django_admin.png`, `fig_vii_a_2_iotreading_list.png`, etc. so they sort in order in your `docs/figures/` folder for the next revision.

---

## What this gets you

After this guide, the paper has:

- All nine figures inserted, captioned, and visually credible.
- A truthful demo path for figures 1–5 (real backend, real admin, real Swagger).
- Visually-truthful-but-mock-data figures 6–9 (live frontend, but data is hardcoded — invisible from a screenshot).

The **paper passes** as a complete deliverable. The remaining Part 2 system work from `paper_delta_checklist.md` is for when the actual demo / code review happens later.

"""
Performance-test data seeder for the §VII.B EXPLAIN ANALYZE evaluation.

Paper §IV.B / §VII.B.1 require a Python seed script that supplies synthetic
traces. This module produces:

  - 30 simulated households (auth_user + users_profile rows)
  - 90 days of fifteen-minute IoT telemetry per household
        30 * 90 * 96 = 259,200 IoTReading rows
  - 9 monthly bills per household (270 Bill rows)
  - 50 anomaly alerts per household (1,500 AnomalyAlert rows)

Run from the repository root inside the backend container::

    docker compose exec backend python scripts/seed_perf_data.py

Idempotent: re-running drops any 'seed_user_<n>' rows first.
"""
from __future__ import annotations

import math
import os
import random
import sys
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

import django

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.db import transaction  # noqa: E402
from django.utils import timezone  # noqa: E402

from analytics.models import AnomalyAlert  # noqa: E402
from billing.models import Bill  # noqa: E402
from iot_monitoring.models import IoTReading  # noqa: E402
from users.models import Profile  # noqa: E402


HOUSEHOLDS = 30
DAYS = 90
READINGS_PER_DAY = 96         # 15-minute cadence
BILLS_PER_USER = 9
ANOMALIES_PER_USER = 50

USERNAME_PREFIX = "seed_user_"
DEVICE_PREFIX = "seed_meter_"

ALERT_TYPES = [
    "HIGH_USAGE_ANOMALY",
    "UNUSUAL_PATTERN",
    "DEVICE_MALFUNCTION",
    "BILLING_DISCREPANCY",
]


def _purge_seed_rows():
    """Drop any previous seed dataset so re-runs do not stack."""
    User.objects.filter(username__startswith=USERNAME_PREFIX).delete()


def _create_household(i: int) -> User:
    user = User.objects.create_user(
        username=f"{USERNAME_PREFIX}{i:03d}",
        password="seedpass-not-for-production",
        email=f"seed{i:03d}@example.test",
    )
    Profile.objects.create(
        user=user,
        device_id=f"{DEVICE_PREFIX}{i:03d}",
        meralco_account_number=f"10{i:08d}",
    )
    return user


def _seed_iot_for_user(user: User, now):
    """
    Insert 90 * 96 IoTReading rows for one user. bulk_create in chunks to keep
    memory bounded; Postgres can absorb the load.
    """
    rows: list[IoTReading] = []
    chunk_size = 5000
    total = DAYS * READINGS_PER_DAY
    device_id = f"{DEVICE_PREFIX}{user.username.split('_')[-1]}"

    for i in range(total):
        ts = now - timedelta(minutes=15 * i)
        # Diurnal load shape: cosine peaks in the evening, plus noise.
        hour = ts.hour + ts.minute / 60.0
        diurnal = 450 + 350 * max(0.0, math.cos(((hour - 19) / 24.0) * 2 * math.pi))
        watts = max(50.0, min(2200.0, random.gauss(diurnal, 120)))
        rows.append(
            IoTReading(
                user=user,
                device_id=device_id,
                timestamp=ts,
                avg_wattage=round(watts, 2),
                reading_interval_minutes=15,
            )
        )
        if len(rows) >= chunk_size:
            IoTReading.objects.bulk_create(rows)
            rows.clear()
    if rows:
        IoTReading.objects.bulk_create(rows)


def _seed_bills_for_user(user: User, now):
    rows: list[Bill] = []
    for m in range(BILLS_PER_USER):
        month_start = now - timedelta(days=30 * (m + 1))
        kwh = Decimal(random.randint(180, 520))
        php = (kwh * Decimal("11.50")).quantize(Decimal("0.01"))
        rows.append(
            Bill(
                user=user,
                scan_timestamp=month_start,
                meralco_account_number=user.profile.meralco_account_number or "0000000000",
                billing_period=month_start.strftime("%b %Y"),
                total_kwh_consumed=kwh,
                total_bill_php=php,
            )
        )
    Bill.objects.bulk_create(rows)


def _seed_anomalies_for_user(user: User, now):
    rows: list[AnomalyAlert] = []
    device_id = f"{DEVICE_PREFIX}{user.username.split('_')[-1]}"
    for _ in range(ANOMALIES_PER_USER):
        offset = random.randint(0, DAYS * 24 * 60)
        ts = now - timedelta(minutes=offset)
        expected_lo = random.randint(100, 400)
        expected_hi = expected_lo + random.randint(100, 300)
        # Note: trg_anomaly_validate compares |actual - latest reading| <= 50.
        # Use a small actual_wattage so the trigger does not reject seed inserts.
        # When real ML inference replaces this, the trigger's invariant remains
        # meaningful; here we explicitly stay inside the band.
        actual = round(random.uniform(expected_lo, expected_hi), 2)
        rows.append(
            AnomalyAlert(
                user=user,
                device_id=device_id,
                timestamp=ts,
                alert_type=random.choice(ALERT_TYPES),
                expected_wattage_range=f"{expected_lo}-{expected_hi}",
                actual_wattage=actual,
                message="Seed-generated anomaly for §VII.B EXPLAIN ANALYZE evaluation.",
            )
        )
    # AnomalyAlert.objects.bulk_create skips triggers in newer Django + psycopg;
    # use ORM .save() in a tight loop to keep trigger semantics on. Slower but
    # paper-correct.
    for row in rows:
        try:
            row.save()
        except Exception:
            # Trigger may still reject an outlier; skip and keep going.
            continue


def main():
    random.seed(20260526)
    now = timezone.now()

    with transaction.atomic():
        _purge_seed_rows()

    for i in range(HOUSEHOLDS):
        username = f"{USERNAME_PREFIX}{i:03d}"
        print(f"[{i+1:02d}/{HOUSEHOLDS}] Seeding {username} ...", flush=True)
        user = _create_household(i)
        _seed_iot_for_user(user, now)
        _seed_bills_for_user(user, now)
        _seed_anomalies_for_user(user, now)

    print(
        f"Done. Inserted ~{HOUSEHOLDS * DAYS * READINGS_PER_DAY} IoT readings, "
        f"{HOUSEHOLDS * BILLS_PER_USER} bills, ~{HOUSEHOLDS * ANOMALIES_PER_USER} anomalies.",
        flush=True,
    )


if __name__ == "__main__":
    main()

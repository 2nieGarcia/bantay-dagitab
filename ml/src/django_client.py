"""Contract C push client.

After schema rationalization, anomaly alerts emitted by the ML service are
written through Django's canonical ingest endpoint (paper §VI.F.2):

    POST {BACKEND_API_URL}/analytics/ingest/
    Header: X-Service-Token: {SERVICE_ACCOUNT_TOKEN}
    Body  : Contract C payload (see contracts/contract_c_anomaly.json)

Django's AnomalyAlertSerializer accepts `user_account_id` as the integer
PK of auth_user. The inference worker reads that integer directly from
iot_monitoring_iotreading.user_id, so no translation is needed here.
"""

from __future__ import annotations

import logging
import os
from typing import Dict, Optional

import requests


LOGGER = logging.getLogger("django_client")

DEFAULT_TIMEOUT_SECONDS = 5
INGEST_PATH = "/analytics/ingest/"


class DjangoAlertPushError(RuntimeError):
    """Raised when Django rejects a Contract C push or is unreachable."""


def _backend_url() -> Optional[str]:
    url = os.environ.get("BACKEND_API_URL")
    return url.rstrip("/") if url else None


def _service_token() -> Optional[str]:
    return os.environ.get("SERVICE_ACCOUNT_TOKEN")


def push_anomaly_alert(
    payload: Dict,
    *,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> Dict:
    """POST one Contract C payload to Django's /analytics/ingest/.

    Returns the parsed JSON response on 201. Raises DjangoAlertPushError on
    any non-2xx response or transport error.
    """
    base_url = _backend_url()
    token = _service_token()

    if not base_url:
        raise DjangoAlertPushError("BACKEND_API_URL is not configured")
    if not token:
        raise DjangoAlertPushError("SERVICE_ACCOUNT_TOKEN is not configured")

    url = f"{base_url}{INGEST_PATH}"
    headers = {
        "Content-Type": "application/json",
        "X-Service-Token": token,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout_seconds)
    except requests.RequestException as exc:
        raise DjangoAlertPushError(f"Transport error contacting Django at {url}: {exc}") from exc

    if response.status_code >= 400:
        raise DjangoAlertPushError(
            f"Django rejected alert push (HTTP {response.status_code}): {response.text[:500]}"
        )

    try:
        return response.json()
    except ValueError:
        return {}


def is_configured() -> bool:
    """Cheap pre-flight check the worker uses to fail fast on misconfiguration."""
    return bool(_backend_url() and _service_token())

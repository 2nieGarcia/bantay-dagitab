import os

from rest_framework import permissions


HOUSEHOLD_USER_GROUP = "Household User"
SERVICE_ACCOUNT_GROUP = "Service Account"
ADMINISTRATOR_GROUP = "Administrator"


class IsHouseholdUser(permissions.BasePermission):
    """
    Authenticated household user accessing only their own records.
    Matches the "Household User" role in paper §VI.F.2.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.groups.filter(name=HOUSEHOLD_USER_GROUP).exists()
            )
        )

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "user_id", None) == request.user.id


class IsServiceAccount(permissions.BasePermission):
    """
    Internal service (ESP32 firmware/simulator, ML service) authenticated via
    a static X-Service-Token header. Matches the "Service Account" role in
    paper §VI.F.2 — SELECT/INSERT-only on the three ingest tables.
    """

    message = "Service Account token is missing or invalid."

    def has_permission(self, request, view):
        service_token = request.META.get("HTTP_X_SERVICE_TOKEN")
        expected_token = os.environ.get("SERVICE_ACCOUNT_TOKEN")
        if not expected_token:
            return False
        return bool(service_token and service_token == expected_token)


class IsAdministrator(permissions.BasePermission):
    """
    Administrator role per paper §VI.F.2 — Django superuser or members of the
    "Administrator" group. Reserved for admin endpoints (Django admin
    handles its own gating; this class exists for any custom DDL-adjacent
    endpoints added later).
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.groups.filter(name=ADMINISTRATOR_GROUP).exists()
            )
        )

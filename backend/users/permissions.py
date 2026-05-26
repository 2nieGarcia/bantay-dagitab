from rest_framework import permissions
import os

class IsHouseholdUser(permissions.BasePermission):
    """
    Custom permission to only allow the household user to access their own records.
    """
    def has_permission(self, request, view):
        # First ensure the user is authenticated globally
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        # Check if the object's user_account_id matches the requesting user.
        # This matches the schema we established for the billing, iot_monitoring, and analytics apps.
        return obj.user_account_id == request.user

class IsServiceAccount(permissions.BasePermission):
    """
    Custom permission to ensure the request comes from the internal FastAPI service.
    """
    message = "Service Account token is missing or invalid."
    def has_permission(self, request, view):
        # Extract a custom header (e.g., X-Service-Token) provided by FastAPI
        service_token = request.META.get('HTTP_X_SERVICE_TOKEN')
        # Compare it against a securely stored environment variable
        expected_token = os.environ.get('SERVICE_ACCOUNT_TOKEN')
        return bool(service_token and service_token == expected_token)

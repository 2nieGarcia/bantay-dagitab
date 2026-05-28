from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AnomalyAlert
from .serializers import AnomalyAlertSerializer
from users.permissions import IsServiceAccount
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample
from django.db import connection
from django.shortcuts import get_object_or_404

@extend_schema_view(
    post=extend_schema(
        summary="Ingest ML Anomaly (Contract C)",
        description="Receives anomaly alert payload from the ML service.",
        request=AnomalyAlertSerializer,
        responses={201: AnomalyAlertSerializer},
        examples=[
            OpenApiExample(
                "Valid Anomaly Payload",
                value={
                    "user_account_id": 1,
                    "device_id": "meter_manila_001",
                    "timestamp": "2024-03-06T02:00:00Z",
                    "alert_type": "high_consumption",
                    "expected_wattage_range": "100-300",
                    "actual_wattage": 850.5,
                    "message": "Unusual spike detected during off-peak hours."
                }
            )
        ]
    )
)
class AnomalyAlertCreateView(generics.CreateAPIView):
    queryset = AnomalyAlert.objects.all()
    serializer_class = AnomalyAlertSerializer
    # Contract C endpoint: service-account auth per paper §VI.F.2. The ML
    # service presents X-Service-Token.
    permission_classes = [IsServiceAccount]

@extend_schema_view(
    get=extend_schema(
        summary="List User Anomalies",
        description=(
            "Retrieve anomaly alerts for the authenticated user. Optional "
            "`?status=active|resolved|dismissed` filters by lifecycle state; "
            "optional `?since=ISO8601` returns only alerts whose timestamp is "
            "at or after that moment (the dashboard uses this with the "
            "active range tab so it doesn't need the SQL view)."
        ),
        responses={200: AnomalyAlertSerializer(many=True)},
    )
)
class AnomalyAlertListView(generics.ListAPIView):
    serializer_class = AnomalyAlertSerializer
    # Uses default IsAuthenticated

    def get_queryset(self):
        qs = AnomalyAlert.objects.filter(user=self.request.user)
        status_param = (self.request.query_params.get('status') or '').lower()
        if status_param in {
            AnomalyAlert.STATUS_ACTIVE,
            AnomalyAlert.STATUS_RESOLVED,
            AnomalyAlert.STATUS_DISMISSED,
        }:
            qs = qs.filter(status=status_param)
        since = self.request.query_params.get('since')
        if since:
            from django.utils.dateparse import parse_datetime
            parsed = parse_datetime(since)
            if parsed is not None:
                qs = qs.filter(timestamp__gte=parsed)
        return qs.order_by('-timestamp')


class AnomalyAlertUpdateView(generics.UpdateAPIView):
    """PATCH /api/analytics/<id>/ to flip an alert's status.

    Used by the reports page's "Mark Resolved" / "Dismiss" buttons.
    Users can only update their own alerts.
    """

    serializer_class = AnomalyAlertSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['patch', 'options', 'head']

    def get_queryset(self):
        return AnomalyAlert.objects.filter(user=self.request.user)


class RecentAnomaliesView(APIView):
    @extend_schema(
        summary="Recent Anomalies (Dashboard)",
        description=(
            "Queries vw_recent_anomalies for dashboard display. Returns only "
            "alerts with status='active' by default (last 7 days). Pass "
            "?include=all to also include resolved/dismissed."
        ),
    )
    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        include = (request.query_params.get('include') or '').lower()
        if include == 'all':
            status_filter = ''
            params = [user_id]
        else:
            status_filter = " AND status = %s"
            params = [user_id, AnomalyAlert.STATUS_ACTIVE]
        with connection.cursor() as cursor:
            cursor.execute(f'''
                SELECT alert_id, device_id, timestamp, alert_type, expected_wattage_range, actual_wattage, message, status
                FROM vw_recent_anomalies
                WHERE user_id = %s{status_filter}
            ''', params)
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return Response(results)

class BillVsTelemetryView(APIView):
    @extend_schema(summary="Bill vs Telemetry (Dashboard)", description="Queries vw_bill_vs_telemetry for dashboard display")
    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        with connection.cursor() as cursor:
            cursor.execute('''
                SELECT bill_id, meralco_account_number, billing_period, billed_kwh, total_bill_php, telemetry_kwh, kwh_variance 
                FROM vw_bill_vs_telemetry 
                WHERE user_id = %s
            ''', [user_id])
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return Response(results)

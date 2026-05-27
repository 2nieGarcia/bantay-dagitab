from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import AnomalyAlert
from .serializers import AnomalyAlertSerializer
from users.permissions import IsServiceAccount
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample
from django.db import connection

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
        description="Retrieve historical anomaly alerts for the authenticated user.",
        responses={200: AnomalyAlertSerializer(many=True)}
    )
)
class AnomalyAlertListView(generics.ListAPIView):
    serializer_class = AnomalyAlertSerializer
    # Uses default IsAuthenticated

    def get_queryset(self):
        return AnomalyAlert.objects.filter(user=self.request.user).order_by('-timestamp')

class RecentAnomaliesView(APIView):
    @extend_schema(summary="Recent Anomalies (Dashboard)", description="Queries vw_recent_anomalies for dashboard display")
    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        with connection.cursor() as cursor:
            cursor.execute('''
                SELECT alert_id, device_id, timestamp, alert_type, expected_wattage_range, actual_wattage, message 
                FROM vw_recent_anomalies 
                WHERE user_id = %s
            ''', [user_id])
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

class ConsumptionIndicatorView(APIView):
    @extend_schema(summary="Consumption Indicator (Dashboard)", description="Returns summary metrics for the dashboard")
    def get(self, request, *args, **kwargs):
        # Stub response matching frontend expectations
        return Response({
            "projected_bill_php": 2500,
            "consumption_so_far_kwh": 210,
            "budget_used_percentage": 75,
            "remaining_budget_php": 833,
            "current_load_watts": 450
        })

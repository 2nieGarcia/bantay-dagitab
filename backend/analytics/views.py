from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from .models import AnomalyAlert
from .serializers import AnomalyAlertSerializer
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample

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
    permission_classes = [AllowAny] # The ML service needs to post

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

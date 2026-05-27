from rest_framework import generics
from .models import IoTReading
from .serializers import IoTReadingSerializer
from users.permissions import IsServiceAccount
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample

@extend_schema_view(
    post=extend_schema(
        summary="Ingest IoT Reading (Contract A)",
        description="Receives payload from an IoT device to record electricity consumption.",
        request=IoTReadingSerializer,
        responses={201: IoTReadingSerializer},
        examples=[
            OpenApiExample(
                "Valid Payload",
                value={
                    "device_id": "meter_manila_001",
                    "user_account_id": 1,
                    "timestamp": "2024-03-01T14:15:00Z",
                    "avg_wattage": 450.5,
                    "reading_interval_minutes": 15
                }
            )
        ]
    )
)
class IoTReadingCreateView(generics.CreateAPIView):
    queryset = IoTReading.objects.all()
    serializer_class = IoTReadingSerializer
    # Contract A endpoint: service-account auth per paper §VI.F.2. The ESP32
    # firmware (or simulator) presents X-Service-Token.
    permission_classes = [IsServiceAccount]

@extend_schema_view(
    get=extend_schema(
        summary="List IoT Readings",
        description="Retrieve historical IoT readings for the authenticated user.",
        responses={200: IoTReadingSerializer(many=True)}
    )
)
class IoTReadingListView(generics.ListAPIView):
    serializer_class = IoTReadingSerializer

    def get_queryset(self):
        return IoTReading.objects.filter(user=self.request.user).order_by('-timestamp')

from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import connection

class MonthlyConsumptionView(APIView):
    @extend_schema(summary="Monthly Consumption (Dashboard)", description="Queries vw_user_monthly_consumption for dashboard display")
    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        with connection.cursor() as cursor:
            cursor.execute('''
                SELECT month, kwh 
                FROM vw_user_monthly_consumption 
                WHERE user_id = %s
                ORDER BY month ASC
            ''', [user_id])
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return Response(results)

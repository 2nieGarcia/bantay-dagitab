from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import IoTReading
from .serializers import IoTReadingSerializer
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
    permission_classes = [AllowAny] 

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

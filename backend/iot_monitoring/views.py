from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import IoTReading, AnomalyAlert
from .serializers import IoTReadingSerializer, AnomalyAlertSerializer

class IoTReadingCreateView(generics.CreateAPIView):
    queryset = IoTReading.objects.all()
    serializer_class = IoTReadingSerializer
    permission_classes = [AllowAny] 

class IoTReadingListView(generics.ListAPIView):
    serializer_class = IoTReadingSerializer

    def get_queryset(self):
        return IoTReading.objects.filter(user=self.request.user).order_by('-timestamp')


class AnomalyAlertListView(generics.ListAPIView):
    serializer_class = AnomalyAlertSerializer

    def get_queryset(self):
        return AnomalyAlert.objects.filter(user=self.request.user).order_by('-timestamp')


class AnomalyAlertActiveView(generics.ListAPIView):
    serializer_class = AnomalyAlertSerializer

    def get_queryset(self):
        return AnomalyAlert.objects.filter(user=self.request.user, status='active').order_by('-timestamp')


class AnomalyAlertResolvedView(generics.ListAPIView):
    serializer_class = AnomalyAlertSerializer

    def get_queryset(self):
        return AnomalyAlert.objects.filter(user=self.request.user, status='resolved').order_by('-resolved_at')

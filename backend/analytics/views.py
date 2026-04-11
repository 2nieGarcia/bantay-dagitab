from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import AnomalyAlert
from .serializers import AnomalyAlertSerializer

class AnomalyAlertCreateView(generics.CreateAPIView):
    queryset = AnomalyAlert.objects.all()
    serializer_class = AnomalyAlertSerializer
    permission_classes = [AllowAny]

class AnomalyAlertListView(generics.ListAPIView):
    serializer_class = AnomalyAlertSerializer

    def get_queryset(self):
        return AnomalyAlert.objects.filter(user=self.request.user).order_by('-timestamp')

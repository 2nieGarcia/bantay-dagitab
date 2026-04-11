from rest_framework import generics
from rest_framework.permissions import AllowAny
from .models import IoTReading
from .serializers import IoTReadingSerializer

class IoTReadingCreateView(generics.CreateAPIView):
    queryset = IoTReading.objects.all()
    serializer_class = IoTReadingSerializer
    permission_classes = [AllowAny] 

class IoTReadingListView(generics.ListAPIView):
    serializer_class = IoTReadingSerializer

    def get_queryset(self):
        return IoTReading.objects.filter(user=self.request.user).order_by('-timestamp')

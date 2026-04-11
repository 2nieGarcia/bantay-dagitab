from rest_framework import generics
from .models import Bill
from .serializers import BillSerializer

class BillListCreateView(generics.ListCreateAPIView):
    serializer_class = BillSerializer

    def get_queryset(self):
        return Bill.objects.filter(user=self.request.user).order_by('-billing_period')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

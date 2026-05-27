from django.urls import path
from .views import IoTReadingCreateView, IoTReadingListView, MonthlyConsumptionView

urlpatterns = [
    path('readings/', IoTReadingListView.as_view(), name='iot-list'),
    path('readings/ingest/', IoTReadingCreateView.as_view(), name='iot-create'),
    path('monthly-consumption/', MonthlyConsumptionView.as_view(), name='monthly-consumption'),
]

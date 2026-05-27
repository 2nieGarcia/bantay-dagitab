from django.urls import path
from .views import (
    ConsumptionWindowView,
    DevInjectIoTReadingView,
    IoTReadingCreateView,
    IoTReadingListView,
    LatestIoTReadingView,
    MonthlyConsumptionView,
)

urlpatterns = [
    path('readings/', IoTReadingListView.as_view(), name='iot-list'),
    path('readings/latest/', LatestIoTReadingView.as_view(), name='iot-latest'),
    path('readings/ingest/', IoTReadingCreateView.as_view(), name='iot-create'),
    path('readings/dev-inject/', DevInjectIoTReadingView.as_view(), name='iot-dev-inject'),
    path('monthly-consumption/', MonthlyConsumptionView.as_view(), name='monthly-consumption'),
    path('consumption-window/', ConsumptionWindowView.as_view(), name='consumption-window'),
]

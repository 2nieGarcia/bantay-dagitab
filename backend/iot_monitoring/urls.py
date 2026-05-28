from django.urls import path
from .views import (
    ConsumptionDailyView,
    ConsumptionWindowView,
    DevInjectIoTReadingView,
    IoTReadingCreateView,
    IoTReadingListView,
    LatestIoTReadingView,
    MonthlyConsumptionView,
    RecentIoTReadingsView,
    RunMlInferenceView,
)

urlpatterns = [
    path('readings/', IoTReadingListView.as_view(), name='iot-list'),
    path('readings/latest/', LatestIoTReadingView.as_view(), name='iot-latest'),
    path('readings/recent/', RecentIoTReadingsView.as_view(), name='iot-recent'),
    path('readings/ingest/', IoTReadingCreateView.as_view(), name='iot-create'),
    path('readings/dev-inject/', DevInjectIoTReadingView.as_view(), name='iot-dev-inject'),
    path('run-ml/', RunMlInferenceView.as_view(), name='run-ml'),
    path('monthly-consumption/', MonthlyConsumptionView.as_view(), name='monthly-consumption'),
    path('consumption-window/', ConsumptionWindowView.as_view(), name='consumption-window'),
    path('consumption-daily/', ConsumptionDailyView.as_view(), name='consumption-daily'),
]

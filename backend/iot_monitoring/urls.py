from django.urls import path
from .views import IoTReadingCreateView, IoTReadingListView

urlpatterns = [
    path('readings/', IoTReadingListView.as_view(), name='iot-list'),
    path('readings/ingest/', IoTReadingCreateView.as_view(), name='iot-create'),
]

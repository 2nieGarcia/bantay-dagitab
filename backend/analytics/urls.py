from django.urls import path
from .views import (
    AnomalyAlertCreateView,
    AnomalyAlertListView,
    AnomalyAlertUpdateView,
    BillVsTelemetryView,
    RecentAnomaliesView,
)

urlpatterns = [
    path('', AnomalyAlertListView.as_view(), name='alert-list'),
    path('<int:pk>/', AnomalyAlertUpdateView.as_view(), name='alert-update'),
    path('ingest/', AnomalyAlertCreateView.as_view(), name='alert-create'),
    path('recent-anomalies/', RecentAnomaliesView.as_view(), name='recent-anomalies'),
    path('bill-vs-telemetry/', BillVsTelemetryView.as_view(), name='bill-vs-telemetry'),
]

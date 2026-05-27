from django.urls import path
from .views import AnomalyAlertCreateView, AnomalyAlertListView, RecentAnomaliesView, BillVsTelemetryView, ConsumptionIndicatorView

urlpatterns = [
    path('', AnomalyAlertListView.as_view(), name='alert-list'),
    path('ingest/', AnomalyAlertCreateView.as_view(), name='alert-create'),
    path('recent-anomalies/', RecentAnomaliesView.as_view(), name='recent-anomalies'),
    path('bill-vs-telemetry/', BillVsTelemetryView.as_view(), name='bill-vs-telemetry'),
    path('consumption-indicator/', ConsumptionIndicatorView.as_view(), name='consumption-indicator'),
]

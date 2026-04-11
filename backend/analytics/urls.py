from django.urls import path
from .views import AnomalyAlertCreateView, AnomalyAlertListView

urlpatterns = [
    path('', AnomalyAlertListView.as_view(), name='alert-list'),
    path('ingest/', AnomalyAlertCreateView.as_view(), name='alert-create'),
]

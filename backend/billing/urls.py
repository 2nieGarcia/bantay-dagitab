from django.urls import path
from .views import (
    BillCreateView,
    BillDetailView,
    BillIngestView,
    BillListView,
    BillOCRUploadView,
)

urlpatterns = [
    path('', BillListView.as_view(), name='bill-list'),
    path('ingest/', BillIngestView.as_view(), name='bill-ingest'),
    path('bills/', BillCreateView.as_view(), name='bill-create'),
    path('ocr-upload/', BillOCRUploadView.as_view(), name='bill-ocr-upload'),
    path('<int:pk>/', BillDetailView.as_view(), name='bill-detail'),
]

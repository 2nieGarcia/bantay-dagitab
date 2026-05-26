from django.urls import path
from .views import BillCreateView, BillListView, BillOCRUploadView, BillIngestView

urlpatterns = [
    path('', BillListView.as_view(), name='bill-list'),
    path('ingest/', BillIngestView.as_view(), name='bill-ingest'),
    path('bills/', BillCreateView.as_view(), name='bill-create'),
    path('ocr-upload/', BillOCRUploadView.as_view(), name='bill-ocr-upload'),
]

from django.urls import path
from .views import BillCreateView, BillListView, BillOCRUploadView

urlpatterns = [
    path('', BillListView.as_view(), name='bill-list'),
    path('bills/', BillCreateView.as_view(), name='bill-create'),
    path('ocr-upload/', BillOCRUploadView.as_view(), name='bill-ocr-upload'),
]

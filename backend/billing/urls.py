from django.urls import path
from .views import BillCreateView, BillListView

urlpatterns = [
    path('', BillListView.as_view(), name='bill-list'),
    path('ingest/', BillCreateView.as_view(), name='bill-create'),
]

from django.urls import path
from .views import BillListCreateView

urlpatterns = [
    path('', BillListCreateView.as_view(), name='bill-list-create'),
]

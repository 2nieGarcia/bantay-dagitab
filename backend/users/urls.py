from django.urls import path
from .views import ProfileDetailView

urlpatterns = [
    path('profile/', ProfileDetailView.as_view(), name='profile-detail'),
]

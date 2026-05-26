from django.urls import path
from .views import ProfileDetailView, UserRegistrationView

urlpatterns = [
    path('profile/', ProfileDetailView.as_view(), name='profile-detail'),
    path('register/', UserRegistrationView.as_view(), name='user-register'),
]

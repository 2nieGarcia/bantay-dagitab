from django.urls import path
from .views import ProfileDetailView, UserRegistrationView, ChangePasswordView, AccountSettingsView

urlpatterns = [
    path('profile/', ProfileDetailView.as_view(), name='profile-detail'),
    path('register/', UserRegistrationView.as_view(), name='user-register'),
    path('settings/security/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('settings/account/', AccountSettingsView.as_view(), name='account-settings'),
]

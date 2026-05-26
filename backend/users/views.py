from rest_framework import generics, permissions
from .models import Profile
from .serializers import ProfileSerializer, UserRegistrationSerializer
from django.contrib.auth.models import User

class ProfileDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    
    def get_object(self):
        # Overriding to always return the currently authenticated user's profile
        # Use get_or_create to automatically heal profiles for old accounts
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

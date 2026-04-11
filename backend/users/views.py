from rest_framework import generics
from .models import Profile
from .serializers import ProfileSerializer

class ProfileDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    
    def get_object(self):
        # Overriding to always return the currently authenticated user's profile
        return self.request.user.profile

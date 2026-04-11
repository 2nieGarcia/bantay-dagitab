from django.urls import path
from .views import ChatbotInteractionView

urlpatterns = [
    path('ask/', ChatbotInteractionView.as_view(), name='chatbot-ask'),
]

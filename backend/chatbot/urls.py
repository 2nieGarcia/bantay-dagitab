from django.urls import path
from .views import ChatbotInteractionView, ChatHistoryView

urlpatterns = [
    path('ask/', ChatbotInteractionView.as_view(), name='chatbot-ask'),
    path('history/', ChatHistoryView.as_view(), name='chatbot-history'),
]

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum
from .serializers import ChatLogSerializer, ChatRequestSerializer
from .services import FastAPIClient
from billing.models import Bill
from analytics.models import AnomalyAlert
from drf_spectacular.utils import extend_schema, OpenApiExample

class ChatbotInteractionView(APIView):
    @extend_schema(
        summary="Ask the AI Chatbot (Contract D)",
        description="Receives a user query, constructs context from recent bills and anomalies, and fetches a response from the ML service.",
        request=ChatRequestSerializer,
        responses={201: ChatLogSerializer},
        examples=[
            OpenApiExample(
                "Valid Chat Query",
                value={
                    "query": "Why was my bill so high last month?"
                }
            )
        ]
    )
    def post(self, request, *args, **kwargs):
        user_query = request.data.get('query', '')
        user = request.user

        recent_bills = Bill.objects.filter(user=user).order_by('-scan_timestamp')[:5]
        total_spent = recent_bills.aggregate(Sum('total_bill_php'))['total_bill_php__sum'] or 0
        
        recent_anomalies = AnomalyAlert.objects.filter(user=user).order_by('-timestamp')[:5]
        anomalies_list = [{'type': a.alert_type, 'actual': a.actual_wattage, 'expected': a.expected_wattage_range} for a in recent_anomalies]

        payload = {
            'user_id': user.id,
            'query': user_query,
            'context': {
                'total_spent_recently': total_spent,
                'recent_anomalies': anomalies_list,
            }
        }

        # Synchronous POST to external service
        llm_text = FastAPIClient.get_llm_response(payload)

        # Save to DB
        serializer = ChatLogSerializer(data={
            'user': user.id,
            'user_query': user_query,
            'response': llm_text
        })
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

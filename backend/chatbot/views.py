from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.db.models import Sum, F, FloatField
from django.db.models.functions import Cast
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiExample

from .models import ChatLog
from .serializers import ChatLogSerializer, ChatRequestSerializer
from .services import LLMClient
from billing.models import Bill
from analytics.models import AnomalyAlert
from iot_monitoring.models import IoTReading


class ChatbotInteractionView(APIView):
    @extend_schema(
        summary="Ask the AI Chatbot (Contract D)",
        description=(
            "Receives a user query, constructs context from the user's most "
            "recent bill, the count of anomalies in that billing period, "
            "recent anomaly alerts, and live IoT readings, and calls an "
            "external LLM API (Groq or Ollama, OpenAI-compatible) per paper "
            "§IV.B / §VII.A.4. The exchange is persisted in chatbot_chatlog."
        ),
        request=ChatRequestSerializer,
        responses={201: ChatLogSerializer},
        examples=[
            OpenApiExample(
                "Valid Chat Query",
                value={"query": "Why was my bill so high last month?"},
            )
        ],
    )
    def post(self, request, *args, **kwargs):
        request_serializer = ChatRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        user_query = request_serializer.validated_data["query"]
        user = request.user

        with transaction.atomic():
            latest_bill = (
                Bill.objects.filter(user=user)
                .order_by("-scan_timestamp")
                .first()
            )

            if latest_bill is not None:
                billing_period = latest_bill.billing_period
                total_kwh = float(latest_bill.total_kwh_consumed)
                total_php = float(latest_bill.total_bill_php)
                anomalies_flagged = AnomalyAlert.objects.filter(
                    user=user, timestamp__gte=latest_bill.scan_timestamp
                ).count()
            else:
                billing_period = "N/A"
                total_kwh = 0.0
                total_php = 0.0
                anomalies_flagged = AnomalyAlert.objects.filter(user=user).count()

            recent_bills = list(
                Bill.objects.filter(user=user)
                .order_by("-scan_timestamp")[:6]
                .values(
                    "billing_period",
                    "total_kwh_consumed",
                    "total_bill_php",
                    "meralco_account_number",
                    "scan_timestamp",
                )
            )

            recent_anomalies = list(
                AnomalyAlert.objects.filter(user=user)
                .order_by("-timestamp")[:10]
                .values(
                    "timestamp",
                    "alert_type",
                    "actual_wattage",
                    "expected_wattage_range",
                    "device_id",
                    "message",
                )
            )

            now = timezone.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_kwh = (
                IoTReading.objects.filter(user=user, timestamp__gte=today_start)
                .aggregate(
                    kwh=Sum(
                        Cast(F("avg_wattage"), FloatField())
                        * Cast(F("reading_interval_minutes"), FloatField())
                        / 60.0
                        / 1000.0
                    )
                )["kwh"]
                or 0.0
            )

            latest_reading = (
                IoTReading.objects.filter(user=user)
                .order_by("-timestamp")
                .values("timestamp", "avg_wattage", "device_id")
                .first()
            )

            payload = {
                "user_account_id": str(user.id),
                "query_timestamp": now.isoformat(),
                "user_query": user_query,
                "context": {
                    "now": now.isoformat(),
                    "billing_period": billing_period,
                    "total_kwh_consumed": total_kwh,
                    "total_bill_php": total_php,
                    "anomalies_flagged": anomalies_flagged,
                    "recent_bills": [
                        {
                            "billing_period": b["billing_period"],
                            "total_kwh_consumed": float(b["total_kwh_consumed"]),
                            "total_bill_php": float(b["total_bill_php"]),
                            "meralco_account_number": b["meralco_account_number"],
                            "scan_timestamp": b["scan_timestamp"].isoformat(),
                        }
                        for b in recent_bills
                    ],
                    "recent_anomalies": [
                        {
                            "timestamp": a["timestamp"].isoformat(),
                            "type": a["alert_type"],
                            "actual_wattage": a["actual_wattage"],
                            "expected_range": a["expected_wattage_range"],
                            "device_id": a["device_id"],
                            "message": a["message"],
                        }
                        for a in recent_anomalies
                    ],
                    "today_kwh_so_far": round(float(today_kwh), 3),
                    "latest_reading": (
                        {
                            "timestamp": latest_reading["timestamp"].isoformat(),
                            "avg_wattage": latest_reading["avg_wattage"],
                            "device_id": latest_reading["device_id"],
                        }
                        if latest_reading
                        else None
                    ),
                },
            }

            response_text = LLMClient.get_chat_response(payload)

            serializer = ChatLogSerializer(
                data={"user_query": user_query, "response": response_text}
            )
            serializer.is_valid(raise_exception=True)
            serializer.save(user=user, response=response_text)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatHistoryView(ListAPIView):
    """Return the authenticated user's chat history, newest first."""

    serializer_class = ChatLogSerializer

    @extend_schema(
        summary="Get my chat history",
        description="Returns the authenticated user's ChatLog rows, newest first. Supports `?limit=N` (default 50, max 200).",
        responses={200: ChatLogSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        try:
            limit = int(self.request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, 200))
        return (
            ChatLog.objects.filter(user=self.request.user)
            .order_by("-query_timestamp")[:limit]
        )

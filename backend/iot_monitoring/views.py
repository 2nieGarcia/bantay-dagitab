import os
from datetime import timedelta

import requests
from django.db.models import Avg, Count, Max, Min, Sum
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import IoTReading
from .serializers import IoTReadingSerializer
from users.permissions import IsServiceAccount
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiExample

@extend_schema_view(
    post=extend_schema(
        summary="Ingest IoT Reading (Contract A)",
        description="Receives payload from an IoT device to record electricity consumption.",
        request=IoTReadingSerializer,
        responses={201: IoTReadingSerializer},
        examples=[
            OpenApiExample(
                "Valid Payload",
                value={
                    "device_id": "meter_manila_001",
                    "user_account_id": 1,
                    "timestamp": "2024-03-01T14:15:00Z",
                    "avg_wattage": 450.5,
                    "reading_interval_minutes": 15
                }
            )
        ]
    )
)
class IoTReadingCreateView(generics.CreateAPIView):
    queryset = IoTReading.objects.all()
    serializer_class = IoTReadingSerializer
    # Contract A endpoint: service-account auth per paper §VI.F.2. The ESP32
    # firmware (or simulator) presents X-Service-Token.
    permission_classes = [IsServiceAccount]

@extend_schema_view(
    get=extend_schema(
        summary="List IoT Readings",
        description="Retrieve historical IoT readings for the authenticated user.",
        responses={200: IoTReadingSerializer(many=True)}
    )
)
class IoTReadingListView(generics.ListAPIView):
    serializer_class = IoTReadingSerializer

    def get_queryset(self):
        return IoTReading.objects.filter(user=self.request.user).order_by('-timestamp')


class LatestIoTReadingView(APIView):
    """Single most recent reading for the calling user.

    Used by the dashboard's live-meter widget. Returns 204 when the user
    has no readings yet so the frontend can render an empty state without
    treating it as an error.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Latest IoT Reading (live meter)",
        description="Returns the user's most recent IoT reading, or 204 if none exists.",
        responses={200: IoTReadingSerializer, 204: None},
    )
    def get(self, request):
        reading = (
            IoTReading.objects.filter(user=request.user)
            .order_by("-timestamp")
            .first()
        )
        if reading is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(IoTReadingSerializer(reading).data)


class RecentIoTReadingsView(APIView):
    """Recent readings within a rolling minute window — for the live sparkline.

    Returns the user's IoT readings whose timestamp falls within the last
    N minutes (default 30, max 1440), sorted ascending so the frontend
    can plot them left-to-right without re-sorting.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Recent IoT Readings (live sparkline)",
        description="Returns the user's readings from the last `minutes` minutes, ascending.",
        responses={200: IoTReadingSerializer(many=True)},
    )
    def get(self, request):
        try:
            minutes = int(request.query_params.get("minutes", 30))
        except (TypeError, ValueError):
            return Response(
                {"detail": "minutes must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if minutes < 1 or minutes > 1440:
            return Response(
                {"detail": "minutes must be between 1 and 1440."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cutoff = timezone.now() - timedelta(minutes=minutes)
        qs = (
            IoTReading.objects.filter(user=request.user, timestamp__gte=cutoff)
            .order_by("timestamp")
        )
        return Response(IoTReadingSerializer(qs, many=True).data)

from django.db import connection


class RunMlInferenceView(APIView):
    """Authenticated trigger that proxies to the ML service's /anomaly/run-once.

    Used by the /simulator page's 'Run inference now' button so the user
    can fire the ML worker from the browser instead of switching to a
    terminal. Forwards with the SERVICE_ACCOUNT_TOKEN as X-Service-Token,
    so the ML service can refuse anyone else (paper §VI.F.2).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Run ML inference now",
        description=(
            "Triggers one pass of the ML inference worker via the FastAPI "
            "ML service. Returns the worker's summary (processed, "
            "alerts_triggered, pushed, push_failures, cursor)."
        ),
        request=None,
        responses={200: None, 502: None, 503: None},
    )
    def post(self, request):
        ml_url = os.environ.get("ML_SERVICE_URL", "http://ml:8001").rstrip("/")
        token = os.environ.get("SERVICE_ACCOUNT_TOKEN")
        if not token:
            return Response(
                {"detail": "SERVICE_ACCOUNT_TOKEN is not configured on the backend."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            response = requests.post(
                f"{ml_url}/anomaly/run-once",
                headers={"X-Service-Token": token},
                timeout=60,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"Could not reach ML service at {ml_url}: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        try:
            payload = response.json()
        except ValueError:
            payload = {"detail": response.text[:500]}

        return Response(payload, status=response.status_code)


class DevInjectIoTReadingView(APIView):
    """Authenticated developer endpoint for ML round-trip testing.

    Creates N synthetic IoT readings owned by the calling user, stepping
    `interval_minutes` apart and ending at the current UTC instant. With
    `count >= 3` and a `avg_wattage` well above the user's historical
    mean, the next `python -m src.inference.run worker` pass will detect
    a sustained-3 anomaly and push Contract C to /api/analytics/ingest/.

    Not part of Contract A — this bypasses the X-Service-Token gate by
    design (the logged-in household is the one asking to test their own
    pipeline). The reading rows it creates are identical to genuine
    Contract A rows otherwise.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Dev: Inject IoT readings for ML testing",
        description=(
            "Creates N readings owned by the logged-in user. Used by "
            "the /ml-tester frontend page to validate the full pipeline."
        ),
        request=None,
        responses={201: IoTReadingSerializer(many=True)},
    )
    def post(self, request):
        device_id = str(request.data.get("device_id") or "meter_test_001").strip()
        try:
            avg_wattage = float(request.data.get("avg_wattage", 3500))
            count = int(request.data.get("count", 3))
            interval_minutes = int(request.data.get("interval_minutes", 15))
        except (TypeError, ValueError):
            return Response(
                {"detail": "avg_wattage, count, and interval_minutes must be numeric."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not device_id:
            return Response(
                {"detail": "device_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if count < 1 or count > 20:
            return Response(
                {"detail": "count must be between 1 and 20."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if interval_minutes < 1 or interval_minutes > 60:
            return Response(
                {"detail": "interval_minutes must be between 1 and 60."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if avg_wattage < 0 or avg_wattage > 10000:
            return Response(
                {"detail": "avg_wattage must be between 0 and 10000."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        readings = []
        for i in range(count):
            offset = (count - 1 - i) * interval_minutes
            readings.append(
                IoTReading.objects.create(
                    user=request.user,
                    device_id=device_id,
                    timestamp=now - timedelta(minutes=offset),
                    avg_wattage=avg_wattage,
                    reading_interval_minutes=interval_minutes,
                )
            )

        serializer = IoTReadingSerializer(readings, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


RANGE_WINDOWS = {
    'day': timedelta(days=1),
    'week': timedelta(days=7),
    'month': timedelta(days=30),
}


class ConsumptionDailyView(APIView):
    """Per-day kWh totals for the dashboard's 'Use per day' bar chart.

    Each row represents one calendar day in UTC. kWh per reading is
    avg_wattage_kw * (reading_interval_minutes / 60).

    Returns oldest -> newest so the frontend can render bars left-to-right.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Per-day kWh totals",
        description="Daily kWh totals for the last N days (1-90). Used by the dashboard's 'Use per day' bar chart.",
    )
    def get(self, request):
        try:
            days = int(request.query_params.get('days', 7))
        except (TypeError, ValueError):
            return Response(
                {"detail": "days must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if days < 1 or days > 90:
            return Response(
                {"detail": "days must be between 1 and 90."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        cutoff = now - timedelta(days=days)
        readings = IoTReading.objects.filter(
            user=request.user,
            timestamp__gte=cutoff,
        ).values_list('timestamp', 'avg_wattage', 'reading_interval_minutes')

        buckets: dict[str, float] = {}
        for ts, watts, interval_min in readings:
            day_key = ts.date().isoformat()
            kwh = (float(watts) / 1000.0) * (float(interval_min) / 60.0)
            buckets[day_key] = buckets.get(day_key, 0.0) + kwh

        # Fill in any zero-data days so the bar chart has a contiguous axis.
        out = []
        for i in range(days - 1, -1, -1):
            day = (now - timedelta(days=i)).date().isoformat()
            out.append({"date": day, "kwh": round(buckets.get(day, 0.0), 3)})
        return Response(out)


class ConsumptionWindowView(APIView):
    """Aggregate the user's IoT readings over a day/week/month window.

    Powers the dashboard's range tabs. Computes kWh from each reading as:
        kwh = (avg_wattage / 1000) * (reading_interval_minutes / 60)

    Returns:
        {
          "range": "day"|"week"|"month",
          "start": <ISO 8601>,
          "end": <ISO 8601>,
          "total_kwh": float,
          "daily_avg_kwh": float,
          "reading_count": int,
          "first_reading": <ISO 8601> | null,
          "last_reading":  <ISO 8601> | null
        }
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Consumption Window (Dashboard tabs)",
        description="Day/week/month rolling-window aggregates for the dashboard's range selector.",
    )
    def get(self, request):
        range_key = (request.query_params.get('range') or 'month').lower()
        if range_key not in RANGE_WINDOWS:
            return Response(
                {"detail": "range must be one of: day, week, month."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        window = RANGE_WINDOWS[range_key]
        end = timezone.now()
        start = end - window

        qs = IoTReading.objects.filter(
            user=request.user,
            timestamp__gte=start,
            timestamp__lt=end,
        )

        agg = qs.aggregate(
            total_wh=Sum('avg_wattage'),
            interval_sum=Sum('reading_interval_minutes'),
            reading_count=Count('id'),
            first_reading=Min('timestamp'),
            last_reading=Max('timestamp'),
            avg_wattage=Avg('avg_wattage'),
        )

        total_kwh = 0.0
        rows = qs.values_list('avg_wattage', 'reading_interval_minutes')
        for watts, interval_min in rows:
            total_kwh += (float(watts) / 1000.0) * (float(interval_min) / 60.0)

        days_in_window = max(window.total_seconds() / 86400.0, 1.0)
        daily_avg_kwh = total_kwh / days_in_window

        return Response({
            "range": range_key,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "total_kwh": round(total_kwh, 3),
            "daily_avg_kwh": round(daily_avg_kwh, 3),
            "reading_count": agg['reading_count'] or 0,
            "first_reading": agg['first_reading'].isoformat() if agg['first_reading'] else None,
            "last_reading": agg['last_reading'].isoformat() if agg['last_reading'] else None,
            "avg_wattage": round(float(agg['avg_wattage']), 2) if agg['avg_wattage'] is not None else None,
        })


class MonthlyConsumptionView(APIView):
    @extend_schema(summary="Monthly Consumption (Dashboard)", description="Queries vw_user_monthly_consumption for dashboard display")
    def get(self, request, *args, **kwargs):
        user_id = request.user.id
        with connection.cursor() as cursor:
            cursor.execute('''
                SELECT month, kwh 
                FROM vw_user_monthly_consumption 
                WHERE user_id = %s
                ORDER BY month ASC
            ''', [user_id])
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return Response(results)

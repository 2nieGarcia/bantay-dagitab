from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from django.urls import reverse
from iot_monitoring.models import IoTReading
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

class RecentIoTReadingsViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create user
        self.user = User.objects.create_user(username='testuser', password='password123')
        
        # Authenticate using JWT
        token = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')
        
        # Create readings
        self.readings = []
        now = timezone.now()
        # Create 600 readings
        for i in range(600):
            # Sort them so they are added sequentially with timestamps spaced by 1 minute
            self.readings.append(
                IoTReading(
                    user=self.user,
                    device_id='device_test',
                    timestamp=now - timedelta(minutes=600 - i),
                    avg_wattage=100.0 + i,
                    reading_interval_minutes=1
                )
            )
        IoTReading.objects.bulk_create(self.readings)

    def test_recent_readings_downsampling(self):
        # When querying minutes=1440 (which spans our 600 readings), it should downsample to exactly 500
        url = reverse('iot-recent')
        response = self.client.get(url, {'minutes': 1440})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 500)
        
        # Verify the sorting is ascending by timestamp
        timestamps = [item['timestamp'] for item in data]
        sorted_timestamps = sorted(timestamps)
        self.assertEqual(timestamps, sorted_timestamps)

    def test_recent_readings_no_downsampling_under_500(self):
        # When querying minutes=200 (which only spans ~200 readings), it should not downsample and return exactly the actual count
        url = reverse('iot-recent')
        response = self.client.get(url, {'minutes': 200})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(len(data), [199, 200])

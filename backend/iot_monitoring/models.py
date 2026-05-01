from django.db import models
from django.contrib.auth.models import User

from django.utils import timezone

class IoTReading(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='iot_readings')
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(default=timezone.now)
    avg_wattage = models.FloatField()
    reading_interval_minutes = models.IntegerField(default=5)

    def __str__(self):
        return f'{self.device_id} - {self.timestamp}'

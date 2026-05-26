from django.db import models
from django.contrib.auth.models import User

from django.utils import timezone

class AnomalyAlert(models.Model):
    alert_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analytics_alerts')
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(default=timezone.now)
    alert_type = models.CharField(max_length=100)
    expected_wattage_range = models.CharField(max_length=100)
    actual_wattage = models.FloatField()
    message = models.TextField()

    def __str__(self):
        return f'Alert: {self.alert_type} on {self.device_id}'

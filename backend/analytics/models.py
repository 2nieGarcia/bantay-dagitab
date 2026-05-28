from django.db import models
from django.contrib.auth.models import User

from django.utils import timezone

class AnomalyAlert(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_RESOLVED = 'resolved'
    STATUS_DISMISSED = 'dismissed'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_RESOLVED, 'Resolved'),
        (STATUS_DISMISSED, 'Dismissed'),
    ]

    alert_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analytics_alerts')
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(default=timezone.now)
    alert_type = models.CharField(max_length=100)
    expected_wattage_range = models.CharField(max_length=100)
    actual_wattage = models.FloatField()
    message = models.TextField()
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )

    def __str__(self):
        return f'Alert: {self.alert_type} on {self.device_id}'

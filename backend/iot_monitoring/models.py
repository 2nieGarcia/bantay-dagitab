from django.db import models
from django.contrib.auth.models import User

class IoTReading(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='iot_readings')
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    avg_wattage = models.FloatField()
    reading_interval_minutes = models.IntegerField(default=5)

    def __str__(self):
        return f'{self.device_id} - {self.timestamp}'


class AnomalyAlert(models.Model):
    ALERT_TYPE_CHOICES = [
        ('HIGH_USAGE_ANOMALY', 'High Usage Anomaly'),
        ('UNUSUAL_PATTERN', 'Unusual Pattern'),
        ('DEVICE_MALFUNCTION', 'Device Malfunction'),
        ('BILLING_DISCREPANCY', 'Billing Discrepancy'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('resolved', 'Resolved'),
    ]

    alert_id = models.CharField(max_length=100, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='anomaly_alerts')
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField()
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    expected_wattage_range = models.CharField(max_length=50)
    actual_wattage = models.FloatField()
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.alert_id} - {self.alert_type}'

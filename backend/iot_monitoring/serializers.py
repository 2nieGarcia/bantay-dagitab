from rest_framework import serializers
from .models import IoTReading, AnomalyAlert

class IoTReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = IoTReading
        fields = '__all__'


class AnomalyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnomalyAlert
        fields = [
            'alert_id', 'device_id', 'timestamp', 'alert_type',
            'expected_wattage_range', 'actual_wattage', 'message',
            'status', 'created_at', 'resolved_at'
        ]

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import IoTReading, AnomalyAlert

class IoTReadingSerializer(serializers.ModelSerializer):
    user_account_id = serializers.PrimaryKeyRelatedField(
        source='user', 
        queryset=User.objects.all(),
        help_text="User account identifier for user-to-device mapping"
    )

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

from rest_framework import serializers
from .models import AnomalyAlert
from django.contrib.auth.models import User

class AnomalyAlertSerializer(serializers.ModelSerializer):
    user_account_id = serializers.PrimaryKeyRelatedField(
        source='user', 
        queryset=User.objects.all(),
        help_text="User account identifier for mapping alert to user"
    )

    class Meta:
        model = AnomalyAlert
        fields = ['alert_id', 'user_account_id', 'device_id', 'timestamp', 'alert_type', 'expected_wattage_range', 'actual_wattage', 'message']
        read_only_fields = ['alert_id']

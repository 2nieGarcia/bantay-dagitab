from rest_framework import serializers
from .models import IoTReading
from django.contrib.auth.models import User

class IoTReadingSerializer(serializers.ModelSerializer):
    user_account_id = serializers.PrimaryKeyRelatedField(
        source='user', 
        queryset=User.objects.all(),
        help_text="User account identifier for user-to-device mapping"
    )

    class Meta:
        model = IoTReading
        fields = ['id', 'device_id', 'user_account_id', 'timestamp', 'avg_wattage', 'reading_interval_minutes']
        read_only_fields = ['id']

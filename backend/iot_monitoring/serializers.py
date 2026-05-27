from rest_framework import serializers
from django.contrib.auth.models import User
from .models import IoTReading


class IoTReadingSerializer(serializers.ModelSerializer):
    user_account_id = serializers.SlugRelatedField(
        slug_field='username',
        source='user',
        queryset=User.objects.all(),
        help_text="User account identifier for user-to-device mapping"
    )

    class Meta:
        model = IoTReading
        fields = '__all__'

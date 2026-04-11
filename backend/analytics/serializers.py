from rest_framework import serializers
from .models import AnomalyAlert

class AnomalyAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnomalyAlert
        fields = '__all__'

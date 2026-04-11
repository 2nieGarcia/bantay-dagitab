from rest_framework import serializers
from .models import IoTReading

class IoTReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = IoTReading
        fields = '__all__'

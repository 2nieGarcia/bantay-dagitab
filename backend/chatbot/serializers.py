from rest_framework import serializers
from .models import ChatLog

class ChatRequestSerializer(serializers.Serializer):
    query = serializers.CharField(
        help_text="The question or query from the user.",
        max_length=1000
    )

class ChatLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatLog
        fields = '__all__'
        read_only_fields = ['id', 'user', 'query_timestamp', 'response']

from rest_framework import serializers
from .models import ChatLog

class ChatRequestSerializer(serializers.Serializer):
    user_query = serializers.CharField(
        help_text="The natural language query from the user.",
        max_length=1000
    )
    lang = serializers.ChoiceField(
        choices=[('en', 'English'), ('fil', 'Filipino')],
        required=False,
        default='en',
        help_text="Response language. Mirrors the user's Settings → Language choice.",
    )

class ChatLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatLog
        fields = '__all__'
        read_only_fields = ['id', 'user', 'query_timestamp', 'response']

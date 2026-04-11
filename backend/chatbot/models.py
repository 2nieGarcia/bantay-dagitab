from django.db import models
from django.contrib.auth.models import User

class ChatLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_logs')
    query_timestamp = models.DateTimeField(auto_now_add=True)
    user_query = models.TextField()
    response = models.TextField()

    def __str__(self):
        return f'Chat by {self.user.username} at {self.query_timestamp}'

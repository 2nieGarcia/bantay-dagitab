from django.contrib import admin

from .models import ChatLog


@admin.register(ChatLog)
class ChatLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "query_timestamp", "user_query_short")
    list_filter = ("query_timestamp", "user")
    search_fields = ("user__username", "user_query", "response")
    readonly_fields = ("query_timestamp",)
    ordering = ("-query_timestamp",)

    def user_query_short(self, obj):
        return (obj.user_query[:80] + "...") if len(obj.user_query) > 80 else obj.user_query

    user_query_short.short_description = "Query"

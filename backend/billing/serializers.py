from rest_framework import serializers
from .models import Bill
from django.contrib.auth.models import User

class BillSerializer(serializers.ModelSerializer):
    user_account_id = serializers.PrimaryKeyRelatedField(
        source='user', 
        queryset=User.objects.all(),
        help_text="User account identifier for mapping OCR bill to user"
    )

    class Meta:
        model = Bill
        fields = ['id', 'user_account_id', 'scan_timestamp', 'meralco_account_number', 'billing_period', 'total_kwh_consumed', 'total_bill_php']
        read_only_fields = ['id']

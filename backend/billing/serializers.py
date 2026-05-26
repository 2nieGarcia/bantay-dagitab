from rest_framework import serializers
from .models import Bill
from django.contrib.auth.models import User

class BillImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField(help_text="An image of the MERALCO bill.")
    user_account_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        help_text="User account identifier for the bill owner.",
        required=False
    )

class OCRExtractedDataSerializer(serializers.Serializer):
    meralco_account_number = serializers.CharField(allow_null=True, required=False)
    billing_period = serializers.CharField(allow_null=True, required=False)
    total_kwh_consumed = serializers.FloatField(allow_null=True, required=False)
    total_bill_php = serializers.FloatField(allow_null=True, required=False)
    scan_timestamp = serializers.DateTimeField()

class OCRResultSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    extracted_data = OCRExtractedDataSerializer(required=False)
    raw_text = serializers.CharField(allow_null=True, required=False)
    needs_manual_verification = serializers.BooleanField()
    error_message = serializers.CharField(allow_null=True, required=False)

class BillSerializer(serializers.ModelSerializer):
    user_account_id = serializers.PrimaryKeyRelatedField(
        source='user',
        queryset=User.objects.all(),
        help_text="User account identifier for mapping OCR bill to user"
    )
    total_kwh_consumed = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, coerce_to_string=False
    )
    total_bill_php = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, coerce_to_string=False
    )

    class Meta:
        model = Bill
        fields = ['id', 'user_account_id', 'scan_timestamp', 'meralco_account_number', 'billing_period', 'total_kwh_consumed', 'total_bill_php']
        read_only_fields = ['id']

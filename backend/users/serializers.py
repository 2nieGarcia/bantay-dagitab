from rest_framework import serializers
from .models import Profile
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    has_completed_onboarding = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ('id', 'user', 'device_id', 'meralco_account_number', 'has_completed_onboarding')

    def get_has_completed_onboarding(self, obj):
        # A profile is "onboarded" once the household has tied an ESP32 and a
        # MERALCO account to itself — the two external IDs that anchor IoT and
        # billing data to this Profile.
        return bool(obj.device_id and obj.meralco_account_number)

    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'confirm_password', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False}
        }

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords must match."})
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        # Create the profile automatically
        Profile.objects.create(user=user)
        return user

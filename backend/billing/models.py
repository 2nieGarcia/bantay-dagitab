from django.db import models
from django.contrib.auth.models import User

class Bill(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bills')
    scan_timestamp = models.DateTimeField(auto_now_add=True)
    meralco_account_number = models.CharField(max_length=100)
    billing_period = models.CharField(max_length=100)
    total_kwh_consumed = models.FloatField()
    total_bill_php = models.FloatField()

    def __str__(self):
        return f'Bill {self.meralco_account_number} - {self.billing_period}'

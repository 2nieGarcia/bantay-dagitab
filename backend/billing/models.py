from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.utils import timezone

class Bill(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bills')
    scan_timestamp = models.DateTimeField(default=timezone.now)
    meralco_account_number = models.CharField(max_length=100)
    billing_period = models.CharField(max_length=100)
    total_kwh_consumed = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    total_bill_php = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_kwh_consumed__gte=0),
                name='bill_total_kwh_consumed_nonneg',
            ),
            models.CheckConstraint(
                condition=models.Q(total_bill_php__gte=0),
                name='bill_total_bill_php_nonneg',
            ),
        ]

    def __str__(self):
        return f'Bill {self.meralco_account_number} - {self.billing_period}'

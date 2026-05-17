import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0002_alter_bill_scan_timestamp'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bill',
            name='total_kwh_consumed',
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.AlterField(
            model_name='bill',
            name='total_bill_php',
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(0)],
            ),
        ),
        migrations.AddConstraint(
            model_name='bill',
            constraint=models.CheckConstraint(
                condition=models.Q(total_kwh_consumed__gte=0),
                name='bill_total_kwh_consumed_nonneg',
            ),
        ),
        migrations.AddConstraint(
            model_name='bill',
            constraint=models.CheckConstraint(
                condition=models.Q(total_bill_php__gte=0),
                name='bill_total_bill_php_nonneg',
            ),
        ),
    ]

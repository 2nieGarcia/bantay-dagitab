from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('analytics', '0003_alter_anomalyalert_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='anomalyalert',
            name='status',
            field=models.CharField(
                choices=[
                    ('active', 'Active'),
                    ('resolved', 'Resolved'),
                    ('dismissed', 'Dismissed'),
                ],
                default='active',
                max_length=16,
            ),
        ),
    ]

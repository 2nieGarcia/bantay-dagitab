from django.db import migrations


class Migration(migrations.Migration):
    """
    Removes the AnomalyAlert model that was previously declared in iot_monitoring
    and materialized by migration 0004. The canonical AnomalyAlert per paper
    §V.A.1 / §V.B.1 / Figure V.1 lives in the analytics app and matches Contract C.
    """

    dependencies = [
        ('iot_monitoring', '0004_anomalyalert'),
    ]

    operations = [
        migrations.DeleteModel(
            name='AnomalyAlert',
        ),
    ]

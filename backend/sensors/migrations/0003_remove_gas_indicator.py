from django.db import migrations, models

def remove_gas_indicator(apps, schema_editor):
    SensorReading = apps.get_model('sensors', 'SensorReading')
    # No action needed for model field removal; handled by schema operations.

class Migration(migrations.Migration):
    dependencies = [
        ('sensors', '0002_sensorreading_proximity_detected_and_more'),
    ]
    operations = [
        migrations.RemoveField(
            model_name='sensorreading',
            name='gas_indicator',
        ),
    ]

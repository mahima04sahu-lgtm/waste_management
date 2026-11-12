from django.db import models
from containers.models import Container, DeviceStatus

class SensorReading(models.Model):
    container = models.ForeignKey(Container, on_delete=models.CASCADE, related_name='sensor_readings')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    proximity_detected = models.BooleanField(default=False, help_text='Proximity sensor detected presence')
    weight = models.FloatField(default=0.0, blank=True, help_text='Weight in kg (optional/legacy)')
    fill_level = models.FloatField(default=0.0, blank=True, help_text='Fill level percentage 0-100% (optional/legacy)')
    temperature = models.FloatField(help_text='Temperature in degrees Celsius')
    humidity = models.FloatField(help_text='Relative humidity percentage')
    gas_indicator = models.FloatField(default=120.0, help_text='VOC gas sensor reading in ppm or raw index')
    moisture = models.FloatField(help_text='Moisture sensor percentage 0-100%')
    device_status = models.CharField(max_length=20, choices=DeviceStatus.choices, default=DeviceStatus.ONLINE)

    class Meta:
        ordering = ['-timestamp']
        get_latest_by = 'timestamp'

    def __str__(self):
        prox_str = "OBJECT DETECTED" if self.proximity_detected else "CLEAR"
        return f"{self.container.container_id} Reading @ {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')} (Proximity: {prox_str})"

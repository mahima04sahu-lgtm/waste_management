from django.db import models
from containers.models import Container

class AlertSeverity(models.TextChoices):
    INFO = 'INFO', 'Information'
    WARNING = 'WARNING', 'Warning'
    HIGH = 'HIGH', 'High Severity'
    CRITICAL = 'CRITICAL', 'Critical Severity'

class AlertType(models.TextChoices):
    HIGH_RISK = 'HIGH_RISK', 'High Operational Risk'
    CRITICAL_RISK = 'CRITICAL_RISK', 'Critical Operational Risk'
    OVERFILLED = 'OVERFILLED', 'Container Overfilled'
    ABNORMAL_TEMP = 'ABNORMAL_TEMP', 'Abnormal Temperature'
    GAS_ANOMALY = 'GAS_ANOMALY', 'Toxic / Gas VOC Anomaly'
    MOISTURE_ANOMALY = 'MOISTURE_ANOMALY', 'Liquid Bio-Spill / Moisture Anomaly'
    AI_UNCERTAINTY = 'AI_UNCERTAINTY', 'AI Classification Uncertainty'
    SENSOR_FAILURE = 'SENSOR_FAILURE', 'Sensor Malfunction'
    DEVICE_OFFLINE = 'DEVICE_OFFLINE', 'Device Disconnected'
    MECHANICAL_FAILURE = 'MECHANICAL_FAILURE', 'Mechanical System Error'

class AlertStatus(models.TextChoices):
    NEW = 'NEW', 'New'
    ACKNOWLEDGED = 'ACKNOWLEDGED', 'Acknowledged'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    RESOLVED = 'RESOLVED', 'Resolved'

class Alert(models.Model):
    container = models.ForeignKey(Container, on_delete=models.CASCADE, related_name='alerts')
    severity = models.CharField(max_length=20, choices=AlertSeverity.choices, default=AlertSeverity.WARNING)
    alert_type = models.CharField(max_length=30, choices=AlertType.choices, default=AlertType.HIGH_RISK)
    message = models.TextField(help_text='Alert summary message')
    recommended_action = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, choices=AlertStatus.choices, default=AlertStatus.NEW)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.severity}] Alert ({self.alert_type}) on Container {self.container.container_id}"

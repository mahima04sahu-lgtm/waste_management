from django.db import models
from containers.models import Container

class VisionClass(models.TextChoices):
    NORMAL = 'NORMAL', 'Normal Waste'
    METAL = 'METAL', 'Metal Material'
    WET = 'WET', 'Wet Material'
    DRY = 'DRY', 'Dry Material'
    UNKNOWN = 'UNKNOWN', 'Unknown / Low Confidence'

class VisionEvent(models.Model):
    container = models.ForeignKey(Container, on_delete=models.CASCADE, related_name='vision_events')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    predicted_class = models.CharField(max_length=30, choices=VisionClass.choices, default=VisionClass.NORMAL)
    confidence = models.FloatField(help_text='AI Classification confidence 0.0 - 100.0%')
    contamination_score = models.FloatField(default=0.0, help_text='Estimated cross-contamination likelihood 0-100%')
    unknown_probability = models.FloatField(default=0.0, help_text='Uncertainty / Out-of-distribution probability 0-100%')
    exception_reason = models.TextField(blank=True, null=True, help_text='Note on potential abnormal condition or anomaly')

    class Meta:
        ordering = ['-timestamp']
        get_latest_by = 'timestamp'

    def __str__(self):
        return f"{self.container.container_id} Vision: {self.predicted_class} ({self.confidence:.1f}%)"

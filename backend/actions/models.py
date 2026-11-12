from django.db import models
from django.contrib.auth.models import User
from containers.models import Container, WasteCategory

class ActionType(models.TextChoices):
    HANDLE_NOW = 'HANDLE NOW', 'Handle Now (Collection Required)'
    HANDLE_LATER = 'HANDLE LATER', 'Handle Later'
    INSPECT = 'INSPECT', 'Inspect Waste Container'
    ISOLATE = 'ISOLATE', 'Isolate Container Immediately'
    MECHANICALLY_TRANSFER = 'MECHANICALLY TRANSFER', 'Mechanically Transfer'
    SPECIALIST_REQUIRED = 'SPECIALIST REQUIRED', 'Biomedical Specialist Required'
    CLEAN_MAINTENANCE = 'CLEAN / MAINTENANCE', 'Clean / Sensor Maintenance'
    NO_ACTION = 'NO ACTION', 'No Action Required'

class ActionPriority(models.TextChoices):
    LOW = 'LOW', 'Low Priority'
    MEDIUM = 'MEDIUM', 'Medium Priority'
    HIGH = 'HIGH', 'High Priority'
    CRITICAL = 'CRITICAL', 'Critical Priority'

class ActionStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACKNOWLEDGED = 'ACKNOWLEDGED', 'Acknowledged'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'

class Action(models.Model):
    container = models.ForeignKey(Container, on_delete=models.CASCADE, related_name='actions')
    action_type = models.CharField(max_length=40, choices=ActionType.choices, default=ActionType.HANDLE_LATER)
    priority = models.CharField(max_length=20, choices=ActionPriority.choices, default=ActionPriority.LOW)
    reason = models.TextField(help_text='Reason for recommended action')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_actions')
    status = models.CharField(max_length=20, choices=ActionStatus.choices, default=ActionStatus.PENDING)
    review_category = models.CharField(
        max_length=30,
        choices=WasteCategory.choices,
        blank=True,
        default='',
        help_text='Waste category this review is associated with (DRY/WET/HAZARDOUS), if applicable'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.priority}] Action {self.action_type} for {self.container.container_id} ({self.status})"

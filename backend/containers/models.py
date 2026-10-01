from django.db import models

class ContainerStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    MAINTENANCE = 'MAINTENANCE', 'Maintenance'

class DeviceStatus(models.TextChoices):
    ONLINE = 'ONLINE', 'Online'
    OFFLINE = 'OFFLINE', 'Offline'

class WasteCategory(models.TextChoices):
    GENERAL = 'GENERAL', 'General Non-Hazardous'
    INFECTIOUS = 'INFECTIOUS', 'Infectious Biomedical'
    SHARPS = 'SHARPS', 'Sharps Waste'
    HAZARDOUS = 'HAZARDOUS', 'Chemical / Hazardous'
    CYTOTOXIC = 'CYTOTOXIC', 'Cytotoxic Waste'
    ANATOMICAL = 'ANATOMICAL', 'Anatomical Waste'

class Container(models.Model):
    container_id = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    hospital = models.CharField(max_length=150, default='City Central Hospital')
    location = models.CharField(max_length=150, help_text='Specific location room or corridor')
    ward = models.CharField(max_length=100, db_index=True, help_text='Ward / Department (e.g. ICU, Emergency Ward, Surgery)')
    status = models.CharField(max_length=20, choices=ContainerStatus.choices, default=ContainerStatus.ACTIVE)
    capacity_liters = models.FloatField(default=60.0)
    device_status = models.CharField(max_length=20, choices=DeviceStatus.choices, default=DeviceStatus.ONLINE)
    waste_category = models.CharField(max_length=30, choices=WasteCategory.choices, default=WasteCategory.INFECTIOUS)
    
    # WasteGuard Station 3-Bin & Manual Review Fields
    wet_fill_pct = models.FloatField(default=42.0)
    dry_fill_pct = models.FloatField(default=68.0)
    hazard_fill_pct = models.FloatField(default=24.0)
    current_waste = models.CharField(max_length=50, default='Dry')
    last_processed = models.CharField(max_length=50, default='2 min ago')
    manual_review_pending = models.BooleanField(default=False)
    manual_review_count = models.IntegerField(default=0)
    manual_review_reason = models.CharField(max_length=255, blank=True, default='')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['container_id']

    def __str__(self):
        return f"Station {self.container_id} ({self.location})"

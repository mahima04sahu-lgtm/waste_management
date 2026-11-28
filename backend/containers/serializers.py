from rest_framework import serializers
from .models import Container

class ContainerSerializer(serializers.ModelSerializer):
    latest_reading = serializers.SerializerMethodField()
    latest_risk = serializers.SerializerMethodField()
    latest_vision = serializers.SerializerMethodField()
    latest_action = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'id', 'container_id', 'name', 'hospital', 'location', 'ward',
            'status', 'capacity_liters', 'device_status', 'waste_category',
            'proximity_detected', 'current_waste', 'last_processed',
            'wet_fill_pct', 'dry_fill_pct', 'metal_fill_pct',
            'manual_review_pending', 'manual_review_count', 'manual_review_reason',
            'created_at', 'updated_at',
            'latest_reading', 'latest_risk', 'latest_vision', 'latest_action'
        ]

    def get_latest_reading(self, obj):
        reading = obj.sensor_readings.first()
        if reading:
            return {
                'id': reading.id,
                'timestamp': reading.timestamp,
                'proximity_detected': reading.proximity_detected,
                'temperature': reading.temperature,
                'humidity': reading.humidity,
                'gas_indicator': getattr(reading, 'gas_indicator', 120.0),
                'moisture': reading.moisture,
                'device_status': reading.device_status,
                'weight': reading.weight,
                'fill_level': reading.fill_level,
            }
        return None

    def get_latest_risk(self, obj):
        return {'risk_score': 0, 'risk_level': 'LOW', 'recommended_action': 'NO ACTION', 'reason': 'Normal baseline'}

    def get_latest_vision(self, obj):
        return None

    def get_latest_action(self, obj):
        return None


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
        risk = obj.risk_predictions.first()
        if risk:
            return {
                'risk_score': risk.risk_score,
                'risk_level': risk.risk_level,
                'recommended_action': risk.recommended_action,
                'reason': risk.reason,
                'timestamp': risk.timestamp,
            }
        return {'risk_score': 0, 'risk_level': 'LOW', 'recommended_action': 'NO ACTION', 'reason': 'Normal baseline'}

    def get_latest_vision(self, obj):
        vision = obj.vision_events.first()
        if vision:
            return {
                'predicted_class': vision.predicted_class,
                'confidence': vision.confidence,
                'contamination_score': vision.contamination_score,
                'unknown_probability': vision.unknown_probability,
                'exception_reason': vision.exception_reason,
                'timestamp': vision.timestamp,
            }
        return None  # No classifier active on this branch — do not fabricate confidence values


    def get_latest_action(self, obj):
        action = obj.actions.exclude(status='COMPLETED').first()
        if not action:
            action = obj.actions.first()
        if action:
            return {
                'id': action.id,
                'action_type': action.action_type,
                'priority': action.priority,
                'reason': action.reason,
                'status': action.status,
                'assigned_to': action.assigned_to.username if action.assigned_to else None,
                'created_at': action.created_at,
            }
        return None


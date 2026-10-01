from rest_framework import serializers
from .models import Container
from analytics.services import get_time_to_fill_prediction

class ContainerSerializer(serializers.ModelSerializer):
    latest_reading = serializers.SerializerMethodField()
    latest_risk = serializers.SerializerMethodField()
    latest_vision = serializers.SerializerMethodField()
    latest_action = serializers.SerializerMethodField()
    time_to_fill_prediction = serializers.SerializerMethodField()

    class Meta:
        model = Container
        fields = [
            'id', 'container_id', 'name', 'hospital', 'location', 'ward',
            'status', 'capacity_liters', 'device_status', 'waste_category',
            'wet_fill_pct', 'dry_fill_pct', 'hazard_fill_pct',
            'current_waste', 'last_processed',
            'manual_review_pending', 'manual_review_count', 'manual_review_reason',
            'created_at', 'updated_at',
            'latest_reading', 'latest_risk', 'latest_vision', 'latest_action',
            'time_to_fill_prediction'
        ]


    def get_latest_reading(self, obj):
        reading = obj.sensor_readings.first()
        if reading:
            return {
                'id': reading.id,
                'timestamp': reading.timestamp,
                'weight': reading.weight,
                'fill_level': reading.fill_level,
                'temperature': reading.temperature,
                'humidity': reading.humidity,
                'gas_indicator': reading.gas_indicator,
                'moisture': reading.moisture,
                'device_status': reading.device_status,
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
        return {'predicted_class': 'NORMAL', 'confidence': 95.0, 'contamination_score': 0, 'unknown_probability': 2}

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

    def get_time_to_fill_prediction(self, obj):
        return get_time_to_fill_prediction(obj)


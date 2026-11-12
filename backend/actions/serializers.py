from rest_framework import serializers
from .models import Action

class ActionSerializer(serializers.ModelSerializer):
    container_id = serializers.CharField(source='container.container_id', read_only=True)
    container_name = serializers.CharField(source='container.name', read_only=True)
    ward = serializers.CharField(source='container.ward', read_only=True)
    location = serializers.CharField(source='container.location', read_only=True)
    assigned_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)

    class Meta:
        model = Action
        fields = [
            'id', 'container', 'container_id', 'container_name', 'ward', 'location',
            'action_type', 'priority', 'reason', 'review_category',
            'assigned_to', 'assigned_username',
            'status', 'created_at', 'completed_at'
        ]

from rest_framework import serializers
from .models import CollectionRecord
from analytics.services import get_time_to_fill_prediction

class CollectionRecordSerializer(serializers.ModelSerializer):
    container_id = serializers.CharField(source='container.container_id', read_only=True)
    location = serializers.CharField(source='container.location', read_only=True)
    ward = serializers.CharField(source='container.ward', read_only=True)
    worker_name = serializers.CharField(source='worker.username', read_only=True, default=None)
    time_to_fill_prediction = serializers.SerializerMethodField()

    class Meta:
        model = CollectionRecord
        fields = [
            'id', 'container', 'container_id', 'location', 'ward',
            'worker', 'worker_name', 'started_at', 'completed_at',
            'weight_collected', 'fill_at_collection', 'status', 'notes',
            'time_to_fill_prediction'
        ]

    def get_time_to_fill_prediction(self, obj):
        return get_time_to_fill_prediction(obj.container)


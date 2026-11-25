from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters import rest_framework as django_filters_framework
from .models import Container, WasteCategory
from .serializers import ContainerSerializer

class ContainerViewSet(viewsets.ModelViewSet):
    queryset = Container.objects.all().prefetch_related('sensor_readings')
    serializer_class = ContainerSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        ward = self.request.query_params.get('ward')
        status = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if ward:
            qs = qs.filter(ward__iexact=ward)
        if status:
            qs = qs.filter(status__iexact=status)
        if search:
            qs = qs.filter(container_id__icontains=search) | qs.filter(location__icontains=search) | qs.filter(ward__icontains=search)

        return qs

    def get_object(self):
        lookup_val = self.kwargs.get('pk')
        if lookup_val and not str(lookup_val).isdigit():
            obj = self.get_queryset().filter(container_id__iexact=lookup_val).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        return super().get_object()

    @action(detail=True, methods=['post'], url_path='select-category')
    def select_category(self, request, pk=None):
        """
        Hardware/User Category Selection Integration Point:
        Selects or activates destination bin (METAL, WET, DRY).
        """
        container = self.get_object()
        category = request.data.get('category', '').upper()
        valid_cats = {
            'DRY': ('Dry', WasteCategory.DRY),
            'WET': ('Wet', WasteCategory.WET),
            'METAL': ('Metal', WasteCategory.METAL),
        }
        if category not in valid_cats:
            return Response(
                {'error': f"Invalid category '{category}'. Choices: METAL, WET, DRY."},
                status=status.HTTP_400_BAD_REQUEST
            )

        label, enum_val = valid_cats[category]
        container.current_waste = label
        container.waste_category = enum_val
        container.last_processed = 'Just now (Category Selected)'
        container.save()

        return Response({
            'status': 'success',
            'container_id': container.container_id,
            'selected_category': label,
            'waste_category': enum_val,
            'last_processed': container.last_processed
        })

    @action(detail=True, methods=['post'], url_path='set-proximity')
    def set_proximity(self, request, pk=None):
        """
        Proximity Sensor Event Ingestion Point:
        Updates whether an object is currently detected in proximity.
        """
        container = self.get_object()
        detected = bool(request.data.get('proximity_detected', request.data.get('detected', True)))
        container.proximity_detected = detected
        container.save()

        return Response({
            'status': 'success',
            'container_id': container.container_id,
            'proximity_detected': container.proximity_detected
        })

from rest_framework import viewsets, permissions, filters
from django_filters import rest_framework as django_filters_framework
from .models import Container
from .serializers import ContainerSerializer

class ContainerViewSet(viewsets.ModelViewSet):
    queryset = Container.objects.all().prefetch_related(
        'sensor_readings', 'risk_predictions', 'vision_events', 'actions'
    )
    serializer_class = ContainerSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        ward = self.request.query_params.get('ward')
        status = self.request.query_params.get('status')
        risk_level = self.request.query_params.get('risk_level')
        search = self.request.query_params.get('search')

        if ward:
            qs = qs.filter(ward__iexact=ward)
        if status:
            qs = qs.filter(status__iexact=status)
        if search:
            qs = qs.filter(container_id__icontains=search) | qs.filter(location__icontains=search) | qs.filter(ward__icontains=search)
        if risk_level:
            qs = qs.filter(risk_predictions__risk_level__iexact=risk_level).distinct()

        return qs

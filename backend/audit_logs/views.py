from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('user')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        entity_id = self.request.query_params.get('entity_id')
        action = self.request.query_params.get('action')

        if entity_id:
            qs = qs.filter(entity_id=str(entity_id))
        if action:
            qs = qs.filter(action__icontains=action)

        return qs

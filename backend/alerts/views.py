from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Alert, AlertStatus
from .serializers import AlertSerializer
from audit_logs.services import log_audit

class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.all().select_related('container')
    serializer_class = AlertSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        severity = self.request.query_params.get('severity')
        alert_type = self.request.query_params.get('alert_type')

        if status_param:
            qs = qs.filter(status__iexact=status_param)
        if severity:
            qs = qs.filter(severity__iexact=severity)
        if alert_type:
            qs = qs.filter(alert_type__iexact=alert_type)

        return qs

    @action(detail=True, methods=['post'], url_path='acknowledge')
    def acknowledge_alert(self, request, pk=None):
        alert_obj = self.get_object()
        alert_obj.status = AlertStatus.ACKNOWLEDGED
        alert_obj.save()

        log_audit(
            action="ALERT_ACKNOWLEDGED",
            entity="Alert",
            entity_id=alert_obj.id,
            user=request.user,
            metadata={'container_id': alert_obj.container.container_id, 'alert_type': alert_obj.alert_type}
        )

        return Response({
            'message': 'Alert acknowledged.',
            'alert': AlertSerializer(alert_obj).data
        })

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve_alert(self, request, pk=None):
        alert_obj = self.get_object()
        alert_obj.status = AlertStatus.RESOLVED
        alert_obj.resolved_at = timezone.now()
        alert_obj.save()

        log_audit(
            action="ALERT_RESOLVED",
            entity="Alert",
            entity_id=alert_obj.id,
            user=request.user,
            metadata={'container_id': alert_obj.container.container_id, 'alert_type': alert_obj.alert_type}
        )

        return Response({
            'message': 'Alert marked RESOLVED.',
            'alert': AlertSerializer(alert_obj).data
        })

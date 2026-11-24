from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Action, ActionStatus
from containers.models import WasteCategory
from .serializers import ActionSerializer
from audit_logs.services import log_audit

class ActionViewSet(viewsets.ModelViewSet):
    queryset = Action.objects.all().select_related('container', 'assigned_to')
    serializer_class = ActionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        container_id = self.request.query_params.get('container_id')

        if status_param:
            qs = qs.filter(status__iexact=status_param)
        if priority:
            qs = qs.filter(priority__iexact=priority)
        if container_id:
            qs = qs.filter(container__container_id=container_id)

        return qs

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm_action(self, request, pk=None):
        action_item = self.get_object()
        user = request.user

        action_item.status = ActionStatus.IN_PROGRESS
        action_item.assigned_to = user
        action_item.save()

        log_audit(
            action=f"ACTION_CONFIRMED_{action_item.action_type.replace(' ', '_')}",
            entity="Action",
            entity_id=action_item.id,
            user=user,
            metadata={
                'container_id': action_item.container.container_id,
                'action_type': action_item.action_type,
                'assigned_user': user.username
            }
        )

        return Response({
            'message': f'Action {action_item.action_type} confirmed and marked IN_PROGRESS.',
            'action': ActionSerializer(action_item).data
        })

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_action(self, request, pk=None):
        action_item = self.get_object()
        user = request.user

        action_item.status = ActionStatus.COMPLETED
        action_item.completed_at = timezone.now()
        if not action_item.assigned_to:
            action_item.assigned_to = user
        action_item.save()

        log_audit(
            action=f"ACTION_COMPLETED_{action_item.action_type.replace(' ', '_')}",
            entity="Action",
            entity_id=action_item.id,
            user=user,
            metadata={
                'container_id': action_item.container.container_id,
                'action_type': action_item.action_type,
                'completed_by': user.username
            }
        )

        return Response({
            'message': f'Action {action_item.action_type} successfully COMPLETED.',
            'action': ActionSerializer(action_item).data
        })

    @action(detail=True, methods=['post'], url_path='confirm-review')
    def confirm_review(self, request, pk=None):
        """
        Reviewer confirms or corrects the waste category for a flagged review.
        Accepts optional `corrected_category` (DRY/WET/METAL).
        Updates Container.waste_category if a correction is provided.
        Records decision in activity history (AuditLog).
        """
        action_item = self.get_object()
        user = request.user
        corrected_category = (request.data.get('corrected_category') or '').strip().upper()

        valid_cats = {'DRY', 'WET', 'METAL'}
        category_applied = None

        if corrected_category and corrected_category in valid_cats:
            # Apply the corrected category to the container
            container = action_item.container
            container.waste_category = corrected_category
            container.current_waste = corrected_category.capitalize()
            container.save()
            action_item.review_category = corrected_category
            category_applied = corrected_category
        elif corrected_category and corrected_category not in valid_cats:
            return Response(
                {'error': f"Invalid category '{corrected_category}'. Must be DRY, WET, or METAL."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Clear the manual_review_pending flag on the container
        container = action_item.container
        container.manual_review_pending = False
        container.manual_review_reason = ''
        container.save()

        # Mark action completed
        action_item.status = ActionStatus.COMPLETED
        action_item.completed_at = timezone.now()
        action_item.assigned_to = user
        action_item.save()

        log_audit(
            action='REVIEW_DECISION_RECORDED',
            entity='Action',
            entity_id=action_item.id,
            user=user,
            metadata={
                'container_id': container.container_id,
                'action_type': action_item.action_type,
                'corrected_category': category_applied,
                'reviewer': user.username if user and user.is_authenticated else 'anonymous',
                'decision': 'CATEGORY_CORRECTED' if category_applied else 'CATEGORY_CONFIRMED',
            }
        )

        return Response({
            'message': 'Review decision recorded and container updated.',
            'corrected_category': category_applied,
            'action': ActionSerializer(action_item).data
        })


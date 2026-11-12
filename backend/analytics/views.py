from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Count, Q
from containers.models import Container, WasteCategory
from risk.models import RiskPrediction, RiskLevel
from alerts.models import Alert
from actions.models import Action, ActionStatus
from audit_logs.models import AuditLog


class AnalyticsSummaryView(APIView):
    """
    Analytics summary for WasteGuard Segregation and Station Monitoring.
    All values derived from live database queries — no hardcoded demo values.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # --- Station KPIs ---
        total_containers = Container.objects.count()
        active_containers = Container.objects.filter(status='ACTIVE', device_status='ONLINE').count()
        offline_devices = Container.objects.filter(device_status='OFFLINE').count()
        proximity_active_count = Container.objects.filter(proximity_detected=True).count()

        # High and Critical risk count based on latest risk predictions
        high_critical_risk_count = Container.objects.filter(
            risk_predictions__risk_level__in=[RiskLevel.HIGH, RiskLevel.CRITICAL]
        ).distinct().count()

        # Pending manual reviews (Action-based, not Container flag)
        pending_reviews = Action.objects.filter(
            status__in=[ActionStatus.PENDING, ActionStatus.IN_PROGRESS]
        ).count()

        # --- Real Waste Category Breakdown (from Container.waste_category) ---
        category_counts = dict(
            Container.objects.values_list('waste_category').annotate(cnt=Count('id'))
        )
        dry_count = category_counts.get(WasteCategory.DRY, 0)
        wet_count = category_counts.get(WasteCategory.WET, 0)
        haz_count = category_counts.get(WasteCategory.HAZARDOUS, 0)
        other_count = total_containers - dry_count - wet_count - haz_count

        # Build percentage breakdown (avoid division by zero)
        def pct(n):
            return round(n / total_containers * 100, 1) if total_containers else 0.0

        category_data = [
            {
                'category': 'Dry Waste',
                'count': dry_count,
                'percentage': pct(dry_count),
                'status': 'Normal Stream'
            },
            {
                'category': 'Wet Waste',
                'count': wet_count,
                'percentage': pct(wet_count),
                'status': 'Normal Stream'
            },
            {
                'category': 'Hazardous Waste',
                'count': haz_count,
                'percentage': pct(haz_count),
                'status': 'Safety Protocol Active' if haz_count > 0 else 'None Assigned'
            },
            {
                'category': 'Other / Unclassified',
                'count': other_count,
                'percentage': pct(other_count),
                'status': 'Unassigned'
            },
        ]

        # --- Real Location Breakdown (grouped by ward from Container) ---
        ward_data = list(
            Container.objects
            .values('ward')
            .annotate(station_count=Count('id'))
            .order_by('ward')
        )

        # --- Efficiency Metrics (from real data) ---
        resolved_reviews = Action.objects.filter(status=ActionStatus.COMPLETED).count()
        # Proximity detections: count SensorReading rows with proximity_detected=True (today not constrained — use total for now)
        from sensors.models import SensorReading
        from django.utils import timezone
        import datetime
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        proximity_today = SensorReading.objects.filter(
            proximity_detected=True,
            timestamp__gte=today_start
        ).count()

        efficiency_metrics = {
            'pending_reviews': pending_reviews,
            'resolved_reviews': resolved_reviews,
            'proximity_detections_today': proximity_today,
            'data_mode': 'LIVE'
        }

        return Response({
            'kpis': {
                'total_containers': total_containers,
                'active_containers': active_containers,
                'proximity_active': proximity_active_count,
                'high_risk_containers': high_critical_risk_count,
                'offline_devices': offline_devices,
                'pending_reviews': pending_reviews,
                'dry_count': dry_count,
                'wet_count': wet_count,
                'hazardous_count': haz_count,
            },
            'location_breakdown': ward_data,
            'category_breakdown': category_data,
            'efficiency_metrics': efficiency_metrics
        })

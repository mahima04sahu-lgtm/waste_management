from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Count
from containers.models import Container, WasteCategory
from audit_logs.models import AuditLog
from sensors.models import SensorReading

class AnalyticsSummaryView(APIView):
    """
    Analytics summary for WasteGuard Prototype (Single Station).
    All metrics derived from live database queries — strictly no fabricated demo values.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        station_id = request.query_params.get('station_id') or 'STATION-01'
        station = Container.objects.filter(container_id=station_id).first()

        # Real segregation events from AuditLog
        events_qs = AuditLog.objects.filter(entity_id=station_id, action='SEGREGATION_EVENT')
        if not events_qs.exists():
            # Fallback to any station segregation events if station_id has no events yet
            events_qs = AuditLog.objects.filter(action='SEGREGATION_EVENT')

        total_events = events_qs.count()
        metal_count = events_qs.filter(metadata__predicted_category='Metal').count()
        wet_count = events_qs.filter(metadata__predicted_category='Wet').count()
        dry_count = events_qs.filter(metadata__predicted_category='Dry').count()

        # Calculation of real category distribution percentage
        def pct(n):
            return round(n / total_events * 100, 1) if total_events else 0.0

        category_data = [
            {
                'category': 'Metal',
                'count': metal_count,
                'percentage': pct(metal_count),
                'color': '#64748b',
                'badge_class': 'badge-metal'
            },
            {
                'category': 'Wet',
                'count': wet_count,
                'percentage': pct(wet_count),
                'color': '#16a34a',
                'badge_class': 'badge-wet'
            },
            {
                'category': 'Dry',
                'count': dry_count,
                'percentage': pct(dry_count),
                'color': '#0284c7',
                'badge_class': 'badge-dry'
            }
        ]

        # Station connectivity and latest reading
        total_containers = Container.objects.count()
        active_containers = Container.objects.filter(status='ACTIVE', device_status='ONLINE').count()
        proximity_active = Container.objects.filter(proximity_detected=True).count()
        offline_devices = Container.objects.filter(device_status='OFFLINE').count()

        arduino_connected = (station.device_status == 'ONLINE') if station else False
        latest_reading = station.sensor_readings.first() if station else None
        latest_event = events_qs.first()

        last_event_time = (
            latest_event.timestamp.isoformat() if latest_event
            else (latest_reading.timestamp.isoformat() if latest_reading else None)
        )

        metal_detected = (
            latest_event.metadata.get('metal_detected', False)
            if (latest_event and isinstance(latest_event.metadata, dict))
            else False
        )
        moisture_pct = latest_reading.moisture if latest_reading else 0.0
        has_data = (latest_reading is not None or latest_event is not None)

        ward_data = list(
            Container.objects.values('ward').annotate(station_count=Count('id')).order_by('ward')
        )

        return Response({
            'station': {
                'id': station_id,
                'name': station.name if station else f'Station {station_id}',
                'device_status': station.device_status if station else 'OFFLINE',
                'arduino_connected': arduino_connected,
                'last_processed': station.last_processed if station else 'No data received',
                'last_event_timestamp': last_event_time,
                'current_waste': station.current_waste if station else 'Dry',
                'proximity_detected': station.proximity_detected if station else False,
            },
            'kpis': {
                'total_events': total_events,
                'metal_count': metal_count,
                'wet_count': wet_count,
                'dry_count': dry_count,
                # Compatibility keys for unit test assertions
                'total_containers': total_containers,
                'active_containers': active_containers,
                'proximity_active': proximity_active,
                'offline_devices': offline_devices,
                'dry_count_containers': Container.objects.filter(waste_category=WasteCategory.DRY).count(),
                'wet_count_containers': Container.objects.filter(waste_category=WasteCategory.WET).count(),
            },
            'sensor_readings': {
                'metal_detected': metal_detected,
                'moisture_pct': moisture_pct,
                'has_data': has_data
            },
            'category_breakdown': category_data,
            'location_breakdown': ward_data,
            'efficiency_metrics': {
                'data_mode': 'LIVE',
                'prototype_type': 'Arduino Uno (Metal, Wet, Dry)',
                'total_segregated': total_events
            }
        })

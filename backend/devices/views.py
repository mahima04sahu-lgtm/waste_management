from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
from django.utils import timezone
from containers.models import Container, WasteCategory
from sensors.models import SensorReading
from vision.models import VisionEvent
from risk.models import RiskPrediction
from risk.services import calculate_container_risk
from actions.models import Action, ActionPriority, ActionStatus
from alerts.models import Alert, AlertSeverity, AlertType, AlertStatus
from audit_logs.services import log_audit

def _parse_bool(val, default=False):
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in ('true', '1', 't', 'yes', 'y', 'detected', 'high', 'active')
    return bool(val)

def _parse_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

class DeviceTelemetryView(APIView):
    """
    Endpoint for IoT ESP32 / Telemetry hardware ingestion:
    POST /api/devices/sensor-data/
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data
        container_id = data.get('container_id') or data.get('station_id') or data.get('device_id')
        if not container_id:
            return Response({'error': 'Missing container_id in payload'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Fetch or initialize container
        container, created = Container.objects.get_or_create(
            container_id=container_id,
            defaults={
                'name': f'Waste Unit {container_id}',
                'location': data.get('location', 'General Ward Corridor'),
                'ward': data.get('ward', 'Emergency Ward'),
                'capacity_liters': 60.0
            }
        )

        device_status = str(data.get('device_status', 'ONLINE')).upper()
        container.device_status = device_status

        # Ingest proximity presence (handles bool, int, string)
        proximity_raw = data.get('proximity_detected', data.get('proximity', data.get('presence', data.get('pir', data.get('ir')))))
        proximity_detected = _parse_bool(proximity_raw, False)
        container.proximity_detected = proximity_detected

        # Optional category update integration point
        new_category = data.get('waste_category', data.get('category', data.get('stream')))
        if new_category:
            cat_str = str(new_category).strip()
            container.current_waste = cat_str.capitalize()
            cat_upper = cat_str.upper()
            if hasattr(WasteCategory, cat_upper):
                container.waste_category = cat_upper
            elif 'DRY' in cat_upper:
                container.waste_category = WasteCategory.DRY
            elif 'WET' in cat_upper:
                container.waste_category = WasteCategory.WET
            elif 'HAZ' in cat_upper:
                container.waste_category = WasteCategory.HAZARDOUS

        # Multi-compartment fill level updates (for 3-bin smart stations)
        if 'dry_fill_pct' in data:
            container.dry_fill_pct = _parse_float(data.get('dry_fill_pct'), container.dry_fill_pct)
        if 'wet_fill_pct' in data:
            container.wet_fill_pct = _parse_float(data.get('wet_fill_pct'), container.wet_fill_pct)
        if 'hazard_fill_pct' in data:
            container.hazard_fill_pct = _parse_float(data.get('hazard_fill_pct'), container.hazard_fill_pct)

        # Fill level calculation from ultrasonic sensor distance if distance_cm is provided
        distance_cm = data.get('distance_cm', data.get('distance'))
        fill_level_raw = data.get('fill_level', data.get('fill', data.get('level')))
        if fill_level_raw is not None:
            fill_level = _parse_float(fill_level_raw, 0.0)
        elif distance_cm is not None:
            dist = _parse_float(distance_cm, 50.0)
            bin_height = _parse_float(data.get('bin_height_cm', 100.0), 100.0)
            fill_level = max(0.0, min(100.0, round((bin_height - dist) / bin_height * 100.0, 1)))
        else:
            fill_level = 0.0

        # If a single fill_level was reported, update active compartment percentage
        if fill_level > 0:
            cur_waste_lower = container.current_waste.lower()
            if 'wet' in cur_waste_lower:
                container.wet_fill_pct = fill_level
            elif 'haz' in cur_waste_lower:
                container.hazard_fill_pct = fill_level
            else:
                container.dry_fill_pct = fill_level

        container.last_processed = 'Just now (ESP32 Wi-Fi)' if data.get('is_esp32', True) else 'Just now (Hardware Event)'
        container.save()

        # 2. Store raw SensorReading
        weight = _parse_float(data.get('weight', data.get('load_cell', 0.0)), 0.0)
        temperature = _parse_float(data.get('temperature', data.get('temp', data.get('temp_c', 24.0))), 24.0)
        humidity = _parse_float(data.get('humidity', data.get('hum', data.get('h', 50.0))), 50.0)
        gas_indicator = _parse_float(data.get('gas_indicator', data.get('gas', data.get('gas_ppm', data.get('voc', 120.0)))), 120.0)
        moisture = _parse_float(data.get('moisture', data.get('moist', data.get('soil_moisture', 20.0))), 20.0)

        reading = SensorReading.objects.create(
            container=container,
            proximity_detected=proximity_detected,
            weight=weight,
            fill_level=fill_level,
            temperature=temperature,
            humidity=humidity,
            gas_indicator=gas_indicator,
            moisture=moisture,
            device_status=device_status
        )

        # 3. Retrieve latest vision event if available
        vision_event = container.vision_events.first()

        # 4. Calculate Risk
        risk_result = calculate_container_risk(container, reading, vision_event)

        risk_pred = RiskPrediction.objects.create(
            container=container,
            risk_score=risk_result['risk_score'],
            risk_level=risk_result['risk_level'],
            recommended_action=risk_result['recommended_action'],
            reason=risk_result['reason']
        )

        # 5. Generate / Update Action
        priority = ActionPriority.LOW
        if risk_result['risk_level'] == 'CRITICAL':
            priority = ActionPriority.CRITICAL
        elif risk_result['risk_level'] == 'HIGH':
            priority = ActionPriority.HIGH
        elif risk_result['risk_level'] == 'MEDIUM':
            priority = ActionPriority.MEDIUM

        action_item = None
        if risk_result['recommended_action'] not in ['NO ACTION']:
            action_item = Action.objects.create(
                container=container,
                action_type=risk_result['recommended_action'],
                priority=priority,
                reason=risk_result['reason'],
                status=ActionStatus.PENDING
            )

        # 6. Generate Alert if high risk or abnormal gas/temp
        created_alert = None
        if risk_result['risk_level'] in ['HIGH', 'CRITICAL'] or gas_indicator >= 350.0:
            severity = AlertSeverity.CRITICAL if (risk_result['risk_level'] == 'CRITICAL' or gas_indicator >= 400.0) else AlertSeverity.HIGH
            alert_type = AlertType.GAS_ANOMALY if gas_indicator >= 350.0 else AlertType.HIGH_RISK
            created_alert = Alert.objects.create(
                container=container,
                severity=severity,
                alert_type=alert_type,
                message=f"Telemetry Alert: {risk_result['reason']}",
                recommended_action=risk_result['recommended_action'],
                status=AlertStatus.NEW
            )

        # 7. Audit Log Entry
        log_audit(
            action="TELEMETRY_RECEIVED",
            entity="Container",
            entity_id=container_id,
            metadata={
                'proximity_detected': proximity_detected,
                'gas_indicator': gas_indicator,
                'temperature': temperature,
                'humidity': humidity,
                'moisture': moisture,
                'fill_level': fill_level,
                'risk_score': risk_result['risk_score'],
                'risk_level': risk_result['risk_level'],
                'recommended_action': risk_result['recommended_action']
            }
        )

        return Response({
            'status': 'success',
            'container_id': container_id,
            'timestamp': reading.timestamp,
            'risk_assessment': {
                'score': risk_result['risk_score'],
                'level': risk_result['risk_level'],
                'action': risk_result['recommended_action'],
                'reason': risk_result['reason']
            },
            'action_generated': action_item.id if action_item else None,
            'alert_generated': created_alert.id if created_alert else None
        }, status=status.HTTP_201_CREATED)

class DevicePingView(APIView):
    """
    Lightweight ping endpoint for ESP32 Wi-Fi hardware health check:
    GET /api/devices/ping/
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'status': 'online',
            'gateway': 'WasteGuard IoT Telemetry Hub',
            'server_time': timezone.now().isoformat(),
            'supported_endpoints': {
                'telemetry': 'POST /api/devices/sensor-data/',
                'config': 'GET /api/devices/config/?container_id=STATION-01',
                'ping': 'GET /api/devices/ping/'
            }
        }, status=status.HTTP_200_OK)

class DeviceConfigView(APIView):
    """
    Station configuration & threshold query endpoint for ESP32:
    GET /api/devices/config/?container_id=STATION-01
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        container_id = request.query_params.get('container_id') or 'STATION-01'
        container = Container.objects.filter(container_id=container_id).first()

        thresholds = getattr(settings, 'RISK_THRESHOLDS', {
            'GAS_HIGH_PPM': 350.0,
            'TEMP_HIGH_C': 35.0,
            'MOISTURE_HIGH': 70.0,
            'FILL_HIGH_PERCENT': 80.0,
        })

        return Response({
            'container_id': container_id,
            'name': container.name if container else f'Station {container_id}',
            'assigned_stream': container.waste_category if container else 'DRY',
            'current_waste': container.current_waste if container else 'Dry',
            'telemetry_interval_sec': 5,
            'thresholds': thresholds
        }, status=status.HTTP_200_OK)

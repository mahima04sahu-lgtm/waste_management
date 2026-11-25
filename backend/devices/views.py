from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
from django.utils import timezone
from containers.models import Container, WasteCategory
from sensors.models import SensorReading
from audit_logs.models import AuditLog
from audit_logs.services import log_audit

def _parse_bool(val, default=False):
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in ('true', '1', 't', 'yes', 'y', 'detected', 'high', 'active', 'metal', 'wet')
    return bool(val)

def _parse_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

class DeviceTelemetryView(APIView):
    """
    Endpoint for IoT Arduino Uno / Hardware Telemetry ingestion:
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
                'name': f'WasteGuard Unit {container_id}',
                'location': data.get('location', 'Station 01 Prototype'),
                'ward': data.get('ward', 'Sorting Lab'),
                'capacity_liters': 60.0
            }
        )

        device_status = str(data.get('device_status', 'ONLINE')).upper()
        container.device_status = device_status

        # Ingest metal detection sensor reading
        metal_raw = data.get('metal_detected', data.get('metal', data.get('metal_sensor', data.get('inductive', False))))
        metal_detected = _parse_bool(metal_raw, False)

        # Ingest moisture / wetness sensor reading
        moisture = _parse_float(data.get('moisture', data.get('moist', data.get('wetness', data.get('soil_moisture', 0.0)))), 0.0)
        moisture_raw = data.get('moisture_detected', data.get('is_wet'))
        if moisture_raw is not None:
            moisture_detected = _parse_bool(moisture_raw, False)
        else:
            moisture_detected = (moisture >= 45.0)

        # Ingest proximity presence (handles bool, int, string)
        proximity_raw = data.get('proximity_detected', data.get('proximity', data.get('presence', data.get('pir', data.get('ir')))))
        proximity_detected = _parse_bool(proximity_raw, False)
        container.proximity_detected = proximity_detected

        # =========================================================================
        # WasteGuard Rule-Based Classification Logic:
        # 1. Metal detected -> Metal
        # 2. Otherwise, moisture detected -> Wet
        # 3. Otherwise -> Dry (Residual category)
        # =========================================================================
        explicit_cat = data.get('waste_category', data.get('category', data.get('stream')))
        if explicit_cat:
            cat_str = str(explicit_cat).strip().upper()
            if 'METAL' in cat_str:
                predicted_category = 'Metal'
                category_enum = WasteCategory.METAL
                rule_applied = 'Explicit designation: Metal'
            elif 'WET' in cat_str:
                predicted_category = 'Wet'
                category_enum = WasteCategory.WET
                rule_applied = 'Explicit designation: Wet'
            else:
                predicted_category = 'Dry'
                category_enum = WasteCategory.DRY
                rule_applied = 'Explicit designation: Dry'
        elif metal_detected:
            predicted_category = 'Metal'
            category_enum = WasteCategory.METAL
            rule_applied = 'Metal sensor detected inductive material'
        elif moisture_detected:
            predicted_category = 'Wet'
            category_enum = WasteCategory.WET
            rule_applied = f'Moisture sensor detected wetness ({moisture:.1f}%)'
        else:
            predicted_category = 'Dry'
            category_enum = WasteCategory.DRY
            rule_applied = 'Residual category (neither metal nor moisture detected)'

        container.current_waste = predicted_category
        container.waste_category = category_enum

        # Multi-compartment fill level updates if provided
        if 'dry_fill_pct' in data:
            container.dry_fill_pct = _parse_float(data.get('dry_fill_pct'), container.dry_fill_pct)
        if 'wet_fill_pct' in data:
            container.wet_fill_pct = _parse_float(data.get('wet_fill_pct'), container.wet_fill_pct)
        if 'metal_fill_pct' in data:
            container.metal_fill_pct = _parse_float(data.get('metal_fill_pct'), getattr(container, 'metal_fill_pct', 0.0))

        fill_level_raw = data.get('fill_level', data.get('fill', data.get('level')))
        fill_level = _parse_float(fill_level_raw, 0.0) if fill_level_raw is not None else 0.0

        container.last_processed = timezone.now().strftime('%d %b %Y, %I:%M %p')
        container.save()

        # 2. Store physical SensorReading
        weight = _parse_float(data.get('weight', data.get('load_cell', 0.0)), 0.0)
        temperature = _parse_float(data.get('temperature', data.get('temp', data.get('temp_c', 24.0))), 24.0)
        humidity = _parse_float(data.get('humidity', data.get('hum', data.get('h', 50.0))), 50.0)
        gas_indicator = _parse_float(data.get('gas_indicator', data.get('gas', data.get('gas_ppm', data.get('voc', 120.0)))), 120.0)

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

        # 3. Create AuditLog event for Segregation History
        segregation_event = AuditLog.objects.create(
            action="SEGREGATION_EVENT",
            entity="Station",
            entity_id=container_id,
            metadata={
                'metal_detected': metal_detected,
                'metal_reading': 1 if metal_detected else 0,
                'moisture_value': moisture,
                'moisture_detected': moisture_detected,
                'predicted_category': predicted_category,
                'rule_applied': rule_applied,
                'status': 'Completed',
                'reading_id': reading.id,
                'device_status': device_status
            }
        )

        # 4. Log Audit Event & Telemetry Confirmation
        log_audit(
            action="TELEMETRY_RECEIVED",
            entity="Container",
            entity_id=container_id,
            metadata={
                'metal_detected': metal_detected,
                'moisture': moisture,
                'predicted_category': predicted_category,
                'rule_applied': rule_applied,
                'device_status': device_status
            }
        )

        certainty_score = 98.5 if predicted_category == 'METAL' else (92.0 if predicted_category == 'WET' else 88.0)

        return Response({
            'status': 'success',
            'container_id': container_id,
            'event_id': segregation_event.id,
            'timestamp': segregation_event.timestamp,
            'segregation_decision': predicted_category,
            'certainty': certainty_score,
            'segregation': {
                'category': predicted_category,
                'rule_applied': rule_applied,
                'metal_detected': metal_detected,
                'moisture': moisture
            }
        }, status=status.HTTP_201_CREATED)

class DevicePingView(APIView):
    """
    Lightweight ping endpoint for Arduino Uno / Hardware health check:
    GET or POST /api/devices/ping/?container_id=STATION-01
    """
    permission_classes = [permissions.AllowAny]

    def _handle_ping(self, request):
        data = request.data if request.method == 'POST' else request.query_params
        station_id = data.get('container_id') or data.get('station_id') or data.get('device_id') or 'STATION-01'
        container = Container.objects.filter(container_id=station_id).first()
        if container:
            container.device_status = 'ONLINE'
            container.last_processed = timezone.now().strftime('%d %b %Y, %I:%M:%S %p')
            container.save(update_fields=['device_status', 'last_processed', 'updated_at'])

        return Response({
            'status': 'online',
            'station_id': station_id,
            'gateway': 'WasteGuard Arduino Uno Telemetry Hub',
            'server_time': timezone.now().isoformat(),
            'supported_endpoints': {
                'telemetry': 'POST /api/devices/sensor-data/',
                'config': 'GET /api/devices/config/?container_id=STATION-01',
                'ping': 'GET /api/devices/ping/'
            }
        }, status=status.HTTP_200_OK)

    def get(self, request):
        return self._handle_ping(request)

    def post(self, request):
        return self._handle_ping(request)

class DeviceConfigView(APIView):
    """
    Station configuration & threshold query endpoint for Arduino Uno:
    GET /api/devices/config/?container_id=STATION-01
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        container_id = request.query_params.get('container_id') or 'STATION-01'
        container = Container.objects.filter(container_id=container_id).first()

        return Response({
            'container_id': container_id,
            'name': container.name if container else f'Station {container_id}',
            'prototype_scope': 'Single-station Arduino Uno prototype (Metal, Wet, Dry)',
            'sensors_confirmed': ['Metal Detection Sensor', 'Moisture / Wetness Sensor'],
            'moisture_threshold_pct': 45.0,
            'assigned_stream': container.waste_category if container else 'DRY',
            'current_waste': container.current_waste if container else 'Dry',
            'telemetry_interval_sec': 3
        }, status=status.HTTP_200_OK)

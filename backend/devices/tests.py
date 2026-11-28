from rest_framework.test import APITestCase
from rest_framework import status
from containers.models import Container
from sensors.models import SensorReading

class DeviceTelemetryTests(APITestCase):
    """
    Test suite for IoT Hardware Telemetry Ingestion endpoint:
    POST /api/devices/sensor-data/
    """

    def setUp(self):
        self.endpoint = '/api/devices/sensor-data/'

    def test_ingest_telemetry_valid(self):
        payload = {
            'container_id': 'STATION-TEST-01',
            'proximity_detected': True,
            'temperature': 25.5,
            'humidity': 52.0,

            'moisture': 28.0,
            'device_status': 'ONLINE'
        }
        response = self.client.post(self.endpoint, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['container_id'], 'STATION-TEST-01')
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('segregation_decision', response.data)
        self.assertIn('segregation', response.data)
        self.assertEqual(response.data['certainty'], 88.0)

        # Verify database state
        container = Container.objects.get(container_id='STATION-TEST-01')
        self.assertTrue(container.proximity_detected)
        self.assertEqual(container.device_status, 'ONLINE')

        reading = SensorReading.objects.filter(container=container).first()
        self.assertIsNotNone(reading)
        self.assertTrue(reading.proximity_detected)
        self.assertEqual(reading.temperature, 25.5)

    def test_ingest_telemetry_missing_container_id(self):
        payload = {
            'proximity_detected': True,
            'temperature': 25.0
        }
        response = self.client.post(self.endpoint, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_ingest_telemetry_updates_category_stream(self):
        payload = {
            'container_id': 'STATION-TEST-02',
            'category': 'Metal',
            'proximity_detected': True
        }
        response = self.client.post(self.endpoint, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['certainty'], 98.5)

        container = Container.objects.get(container_id='STATION-TEST-02')
        self.assertEqual(container.current_waste, 'Metal')

    def test_backward_compatible_sensors_update_endpoint(self):
        compat_url = '/api/sensors/update/'
        payload = {
            'request_id': 'REQ-UNO-99',
            'wet_value': 68.0,
            'wet_detected': True,
            'metal_increment': 0,
            'wet_increment': 1
        }
        response = self.client.post(compat_url, payload, format='json', HTTP_X_DEVICE_KEY='WG-KEY')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['segregation_decision'], 'Wet')
        self.assertEqual(response.data['certainty'], 92.0)
        self.assertEqual(response.data['request_id'], 'REQ-UNO-99')

    def test_get_method_not_allowed(self):
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

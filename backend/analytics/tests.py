from rest_framework.test import APITestCase
from rest_framework import status
from containers.models import Container, WasteCategory

class AnalyticsSummaryTests(APITestCase):
    """
    Test suite for Station Analytics Summary endpoint:
    GET /api/analytics/summary/
    """

    def setUp(self):
        self.endpoint = '/api/analytics/summary/'
        Container.objects.create(
            container_id='ANALYTICS-BIN-01',
            name='Analytics Bin 01',
            location='Central Garden',
            ward='Zone A',
            device_status='ONLINE',
            proximity_detected=True,
            current_waste='Dry',
            waste_category=WasteCategory.DRY
        )
        Container.objects.create(
            container_id='ANALYTICS-BIN-02',
            name='Analytics Bin 02',
            location='Cafeteria',
            ward='Zone B',
            device_status='ONLINE',
            proximity_detected=False,
            current_waste='Wet',
            waste_category=WasteCategory.WET
        )

    def test_analytics_summary_get_structure(self):
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertIn('kpis', response.data)
        self.assertIn('location_breakdown', response.data)
        self.assertIn('category_breakdown', response.data)
        self.assertIn('efficiency_metrics', response.data)

        kpis = response.data['kpis']
        self.assertGreaterEqual(kpis['total_containers'], 2)
        self.assertGreaterEqual(kpis['active_containers'], 2)
        self.assertGreaterEqual(kpis['proximity_active'], 1)

    def test_analytics_summary_post_not_allowed(self):
        response = self.client.post(self.endpoint, {})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

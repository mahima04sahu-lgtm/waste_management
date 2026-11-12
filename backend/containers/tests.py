from rest_framework.test import APITestCase
from rest_framework import status
from containers.models import Container, WasteCategory

class ContainerActionTests(APITestCase):
    """
    Test suite for Station/Container Category Selection and Proximity Sensor Endpoints:
    POST /api/containers/<id>/select-category/
    POST /api/containers/<id>/set-proximity/
    """

    def setUp(self):
        self.container = Container.objects.create(
            container_id='UNIT-TEST-01',
            name='Test Station 01',
            location='Central Plaza',
            ward='Zone A',
            device_status='ONLINE',
            proximity_detected=False,
            current_waste='Dry',
            waste_category=WasteCategory.DRY
        )

    def test_select_category_valid_dry(self):
        url = f'/api/containers/{self.container.id}/select-category/'
        response = self.client.post(url, {'category': 'DRY'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['selected_category'], 'Dry')
        self.assertEqual(response.data['waste_category'], WasteCategory.DRY)

        self.container.refresh_from_db()
        self.assertEqual(self.container.current_waste, 'Dry')
        self.assertEqual(self.container.waste_category, WasteCategory.DRY)

    def test_select_category_valid_wet(self):
        url = f'/api/containers/{self.container.id}/select-category/'
        response = self.client.post(url, {'category': 'WET'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['selected_category'], 'Wet')
        self.assertEqual(response.data['waste_category'], WasteCategory.WET)

        self.container.refresh_from_db()
        self.assertEqual(self.container.current_waste, 'Wet')
        self.assertEqual(self.container.waste_category, WasteCategory.WET)

    def test_select_category_valid_hazardous(self):
        url = f'/api/containers/{self.container.id}/select-category/'
        response = self.client.post(url, {'category': 'HAZARDOUS'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['selected_category'], 'Hazard')
        self.assertEqual(response.data['waste_category'], WasteCategory.HAZARDOUS)

        self.container.refresh_from_db()
        self.assertEqual(self.container.current_waste, 'Hazard')
        self.assertEqual(self.container.waste_category, WasteCategory.HAZARDOUS)

    def test_select_category_invalid(self):
        url = f'/api/containers/{self.container.id}/select-category/'
        response = self.client.post(url, {'category': 'E-WASTE'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_set_proximity_detected_true(self):
        url = f'/api/containers/{self.container.id}/set-proximity/'
        response = self.client.post(url, {'proximity_detected': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['proximity_detected'])

        self.container.refresh_from_db()
        self.assertTrue(self.container.proximity_detected)

    def test_set_proximity_detected_false(self):
        # Set to True first
        self.container.proximity_detected = True
        self.container.save()

        url = f'/api/containers/{self.container.id}/set-proximity/'
        response = self.client.post(url, {'detected': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['proximity_detected'])

        self.container.refresh_from_db()
        self.assertFalse(self.container.proximity_detected)

    def test_non_existent_container_returns_404(self):
        url = '/api/containers/99999/select-category/'
        response = self.client.post(url, {'category': 'DRY'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SensorReadingViewSet
from devices.views import DeviceTelemetryView

router = DefaultRouter()
router.register(r'', SensorReadingViewSet, basename='sensor-reading')

urlpatterns = [
    # Backward compatibility endpoint for sketches posting to /api/sensors/update/
    path('update/', DeviceTelemetryView.as_view(), name='sensor-update-compat'),
    path('', include(router.urls)),
]

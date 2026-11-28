from django.urls import path
from .views import DeviceTelemetryView, DevicePingView, DeviceConfigView

urlpatterns = [
    path('sensor-data/', DeviceTelemetryView.as_view(), name='device-sensor-data'),
    path('ping/', DevicePingView.as_view(), name='device-ping'),
    path('config/', DeviceConfigView.as_view(), name='device-config'),
]

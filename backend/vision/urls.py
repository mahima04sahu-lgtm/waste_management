from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisionEventViewSet, ScanWasteView

router = DefaultRouter()
router.register(r'events', VisionEventViewSet, basename='vision-event')

urlpatterns = [
    path('scan/', ScanWasteView.as_view(), name='vision-scan'),
    path('', include(router.urls)),
]

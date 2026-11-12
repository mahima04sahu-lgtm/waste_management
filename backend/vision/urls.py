from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisionEventViewSet

router = DefaultRouter()
router.register(r'events', VisionEventViewSet, basename='vision-event')

urlpatterns = [
    path('', include(router.urls)),
]

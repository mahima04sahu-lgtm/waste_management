from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import VisionEvent, VisionClass
from .serializers import VisionEventSerializer
from .scanner_service import WasteScannerService
from containers.models import Container
from audit_logs.models import AuditLog

class VisionEventViewSet(viewsets.ModelViewSet):
    queryset = VisionEvent.objects.all()
    serializer_class = VisionEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        container_id = self.request.query_params.get('container_id')
        if container_id:
            qs = qs.filter(container__container_id=container_id)
        return qs

class ScanWasteView(APIView):
    """
    Live AI Camera Scanner Endpoint:
    Accepts base64 image frame from browser webcam or upload.
    Runs YOLOv8 object detection, returns bounding boxes, waste stream (Dry, Wet, Hazard),
    worker safety protocol, and updates assigned container.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        image_data = request.data.get('image')
        if not image_data and 'file' in request.FILES:
            image_data = request.FILES['file']

        if not image_data:
            return Response({'error': 'No image provided. Send base64 data URL in "image" or multipart "file".'},
                            status=status.HTTP_400_BAD_REQUEST)

        conf_threshold = float(request.data.get('confidence_threshold', 0.25))
        container_id = request.data.get('container_id', 'STATION-01')

        try:
            analysis = WasteScannerService.analyze_frame(image_data, conf_threshold=conf_threshold)

            # Optionally sync to target station in database ONLY if an actual waste item was detected
            target_container = Container.objects.filter(container_id=container_id).first()
            if target_container and analysis.get('detected', True):
                # Update current waste & last processed time
                target_container.current_waste = analysis['primary_category'].capitalize()
                target_container.last_processed = 'Just now (AI Scan)'

                # If hazard detected, flag for manual review / safety check
                if analysis['primary_category'] == 'HAZARD':
                    target_container.manual_review_pending = True
                    target_container.manual_review_reason = f"AI Scanner detected {analysis['primary_label']} ({analysis['confidence']}%)"
                    target_container.manual_review_count = (target_container.manual_review_count or 0) + 1
                target_container.save()

                # Map category to VisionClass enum
                cat_to_vclass = {
                    'DRY': VisionClass.NORMAL,
                    'WET': VisionClass.NORMAL,
                    'HAZARD': VisionClass.HAZARD,
                    'BIOHAZARD': VisionClass.BIOHAZARD
                }
                v_class = cat_to_vclass.get(analysis['primary_category'], VisionClass.NORMAL)

                # Create VisionEvent in database
                VisionEvent.objects.create(
                    container=target_container,
                    predicted_class=v_class,
                    confidence=analysis['confidence'],
                    contamination_score=85.0 if analysis['primary_category'] == 'HAZARD' else 5.0,
                    unknown_probability=max(0.0, 100.0 - analysis['confidence']),
                    exception_reason=analysis['safety_protocol']['handling_guideline']
                )

                # Log audit event with correct field names
                user = request.user if request.user.is_authenticated else None
                AuditLog.objects.create(
                    user=user,
                    action='AI_CAMERA_SCAN',
                    entity='Container',
                    entity_id=target_container.container_id,
                    metadata={
                        'label': analysis['primary_label'],
                        'category': analysis['primary_category'],
                        'confidence': analysis['confidence'],
                        'item_count': analysis['item_count'],
                        'container_name': target_container.name
                    }
                )

                analysis['station_id'] = target_container.container_id
                analysis['station_name'] = target_container.name

            return Response(analysis, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

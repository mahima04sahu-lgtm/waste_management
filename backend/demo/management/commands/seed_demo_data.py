import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from users.models import UserProfile, Role
from containers.models import Container, ContainerStatus, DeviceStatus, WasteCategory
from sensors.models import SensorReading
from vision.models import VisionEvent, VisionClass
from risk.models import RiskPrediction, RiskLevel
from risk.services import calculate_container_risk
from actions.models import Action, ActionPriority, ActionStatus
from alerts.models import Alert, AlertSeverity, AlertType, AlertStatus
from collection.models import CollectionRecord, CollectionStatus
from audit_logs.models import AuditLog

class Command(BaseCommand):
    help = 'Seeds realistic hospital waste management demo data for SIH 2026 HazGuard prototype'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Starting HazGuard Demo Data Seeding...'))

        # 1. Create Role Accounts
        users_def = [
            {'username': 'admin', 'email': 'admin@hospital.org', 'role': Role.ADMIN, 'emp_id': 'EMP-001', 'name': 'Dr. Alok Verma', 'ward': 'Administration'},
            {'username': 'supervisor', 'email': 'supervisor@hospital.org', 'role': Role.SUPERVISOR, 'emp_id': 'EMP-002', 'name': 'Sunita Rao', 'ward': 'Biomedical Waste Department'},
            {'username': 'raj_sharma', 'email': 'raj.sharma@hospital.org', 'role': Role.OPERATOR, 'emp_id': 'EMP-003', 'name': 'Raj Sharma', 'ward': 'Emergency & ICU Wards'},
            {'username': 'safety_officer', 'email': 'safety@hospital.org', 'role': Role.SAFETY_OFFICER, 'emp_id': 'EMP-004', 'name': 'Priya Mehta', 'ward': 'Hospital Safety Division'},
        ]

        user_objects = {}
        for u in users_def:
            user_obj, created = User.objects.get_or_create(
                username=u['username'],
                defaults={'email': u['email'], 'first_name': u['name'].split()[0], 'last_name': ' '.join(u['name'].split()[1:])}
            )
            user_obj.set_password('password123')
            user_obj.save()
            user_objects[u['username']] = user_obj

            UserProfile.objects.update_or_create(
                user=user_obj,
                defaults={
                    'role': u['role'],
                    'employee_id': u['emp_id'],
                    'ward_assigned': u['ward'],
                    'phone_number': '+91-9876543210'
                }
            )
            self.stdout.write(self.style.SUCCESS(f"User ready: {u['username']} (Role: {u['role']}, EmpID: {u['emp_id']})"))

        # 2. Containers Setup (Exactly 5 WasteGuard Automated Sorting Stations)
        Container.objects.all().delete()
        Action.objects.all().delete()
        Alert.objects.all().delete()

        containers_def = [
            {
                'id': 'STATION-01', 'name': 'WasteGuard Station 01', 'ward': 'Central Garden Zone', 'loc': 'Central Garden',
                'cat': WasteCategory.DRY, 'status': ContainerStatus.ACTIVE, 'dev': DeviceStatus.ONLINE,
                'wet': 42.0, 'dry': 68.0, 'metal': 25.0, 'current': 'Dry', 'last': '2 min ago',
                'proximity': True,
                'mr_pending': False, 'mr_count': 0, 'mr_reason': ''
            },
            {
                'id': 'STATION-02', 'name': 'WasteGuard Station 02', 'ward': 'Cafeteria & Dining', 'loc': 'Cafeteria',
                'cat': WasteCategory.WET, 'status': ContainerStatus.ACTIVE, 'dev': DeviceStatus.ONLINE,
                'wet': 78.0, 'dry': 85.0, 'metal': 15.0, 'current': 'Wet', 'last': '1 min ago',
                'proximity': True,
                'mr_pending': True, 'mr_count': 2, 'mr_reason': 'Classification verification requested'
            },
            {
                'id': 'STATION-03', 'name': 'WasteGuard Station 03', 'ward': 'Academic Wing', 'loc': 'Academic Block',
                'cat': WasteCategory.DRY, 'status': ContainerStatus.ACTIVE, 'dev': DeviceStatus.ONLINE,
                'wet': 30.0, 'dry': 55.0, 'metal': 10.0, 'current': 'Dry', 'last': '4 min ago',
                'proximity': False,
                'mr_pending': False, 'mr_count': 0, 'mr_reason': ''
            },
            {
                'id': 'STATION-04', 'name': 'WasteGuard Station 04', 'ward': 'Hostel Complex', 'loc': 'Hostel',
                'cat': WasteCategory.METAL, 'status': ContainerStatus.ACTIVE, 'dev': DeviceStatus.ONLINE,
                'wet': 15.0, 'dry': 45.0, 'metal': 60.0, 'current': 'Metal', 'last': '3 min ago',
                'proximity': False,
                'mr_pending': False, 'mr_count': 0, 'mr_reason': ''
            },
            {
                'id': 'STATION-05', 'name': 'WasteGuard Station 05', 'ward': 'Parking & Transport', 'loc': 'Parking Area',
                'cat': WasteCategory.DRY, 'status': ContainerStatus.ACTIVE, 'dev': DeviceStatus.ONLINE,
                'wet': 20.0, 'dry': 45.0, 'metal': 10.0, 'current': 'Dry', 'last': '10 min ago',
                'proximity': False,
                'mr_pending': False, 'mr_count': 0, 'mr_reason': ''
            }
        ]

        now = timezone.now()

        for cdata in containers_def:
            container, _ = Container.objects.update_or_create(
                container_id=cdata['id'],
                defaults={
                    'name': cdata['name'],
                    'ward': cdata['ward'],
                    'location': cdata['loc'],
                    'waste_category': cdata['cat'],
                    'status': cdata['status'],
                    'device_status': cdata['dev'],
                    'capacity_liters': 180.0,
                    'proximity_detected': cdata.get('proximity', False),
                    'wet_fill_pct': cdata['wet'],
                    'dry_fill_pct': cdata['dry'],
                    'metal_fill_pct': cdata['metal'],
                    'hazard_fill_pct': 0.0,
                    'current_waste': cdata['current'],
                    'last_processed': cdata['last'],
                    'manual_review_pending': cdata['mr_pending'],
                    'manual_review_count': cdata['mr_count'],
                    'manual_review_reason': cdata['mr_reason'],
                }
            )

            fill = max(cdata['wet'], cdata['dry'], cdata['metal'])
            weight = round(fill * 0.35, 1)
            temp = 26.5
            humidity = 55.0
            gas = 120.0
            moisture = 30.0
            v_class = VisionClass.NORMAL
            v_conf = 92.0
            v_contam = 5.0
            v_unk = 2.0
            v_exc = cdata['mr_reason'] if cdata['mr_pending'] else None

            # Create Sensor Reading
            reading = SensorReading.objects.create(
                container=container,
                timestamp=now,
                proximity_detected=cdata.get('proximity', False),
                weight=weight,
                fill_level=fill,
                temperature=temp,
                humidity=humidity,
                gas_indicator=gas,
                moisture=moisture,
                device_status=cdata['dev']
            )

            # Create Vision Event
            vision_event = VisionEvent.objects.create(
                container=container,
                timestamp=now,
                predicted_class=v_class,
                confidence=v_conf,
                contamination_score=v_contam,
                unknown_probability=v_unk,
                exception_reason=v_exc
            )

            # Calculate Risk
            risk_dict = calculate_container_risk(container, reading, vision_event)
            risk_pred = RiskPrediction.objects.create(
                container=container,
                timestamp=now,
                risk_score=risk_dict['risk_score'],
                risk_level=risk_dict['risk_level'],
                recommended_action=risk_dict['recommended_action'],
                reason=risk_dict['reason']
            )

            # Create Action Queue Item if recommended
            if risk_dict['recommended_action'] not in ['NO ACTION']:
                prio = ActionPriority.LOW
                if risk_dict['risk_level'] == RiskLevel.CRITICAL:
                    prio = ActionPriority.CRITICAL
                elif risk_dict['risk_level'] == RiskLevel.HIGH:
                    prio = ActionPriority.HIGH
                elif risk_dict['risk_level'] == RiskLevel.MEDIUM:
                    prio = ActionPriority.MEDIUM

                Action.objects.create(
                    container=container,
                    action_type=risk_dict['recommended_action'],
                    priority=prio,
                    reason=risk_dict['reason'],
                    assigned_to=user_objects['raj_sharma'] if prio in [ActionPriority.HIGH, ActionPriority.CRITICAL] else None,
                    status=ActionStatus.PENDING
                )

            # Create Alert if High/Critical risk or gas anomaly
            if risk_dict['risk_level'] in [RiskLevel.HIGH, RiskLevel.CRITICAL] or gas >= 350:
                sev = AlertSeverity.CRITICAL if risk_dict['risk_level'] == RiskLevel.CRITICAL else AlertSeverity.HIGH
                atype = AlertType.GAS_ANOMALY if gas >= 350 else AlertType.HIGH_RISK
                Alert.objects.create(
                    container=container,
                    severity=sev,
                    alert_type=atype,
                    message=f"Risk Alert for {container.container_id} ({container.ward}): {risk_dict['reason']}",
                    recommended_action=risk_dict['recommended_action'],
                    status=AlertStatus.NEW
                )

            # Generate historical collection records for analytics
            if random.choice([True, False]):
                CollectionRecord.objects.create(
                    container=container,
                    worker=user_objects['raj_sharma'],
                    started_at=now - timedelta(hours=random.randint(4, 48)),
                    completed_at=now - timedelta(hours=random.randint(2, 46)),
                    weight_collected=round(random.uniform(12.0, 28.0), 1),
                    fill_at_collection=round(random.uniform(80.0, 95.0), 1),
                    status=CollectionStatus.COMPLETED,
                    notes="Standard segregation collection completed safely."
                )

        # 3. Create Key Prototype Audit Log Entries (Metal, Wet, Dry)
        AuditLog.objects.create(
            user=user_objects['admin'],
            action="SYSTEM_INITIALIZED",
            entity="System",
            entity_id="STATION-01",
            metadata={'message': 'WasteGuard Prototype System initialized (Metal, Wet, Dry segregation).'}
        )
        AuditLog.objects.create(
            action="SEGREGATION_EVENT",
            entity="Station",
            entity_id="STATION-01",
            metadata={
                'metal_detected': True,
                'metal_reading': 1,
                'moisture_value': 12.0,
                'moisture_detected': False,
                'predicted_category': 'Metal',
                'rule_applied': 'Metal sensor detected inductive material',
                'status': 'Completed',
                'device_status': 'ONLINE'
            }
        )
        AuditLog.objects.create(
            action="SEGREGATION_EVENT",
            entity="Station",
            entity_id="STATION-01",
            metadata={
                'metal_detected': False,
                'metal_reading': 0,
                'moisture_value': 68.0,
                'moisture_detected': True,
                'predicted_category': 'Wet',
                'rule_applied': 'Moisture sensor detected wetness (68.0%)',
                'status': 'Completed',
                'device_status': 'ONLINE'
            }
        )
        AuditLog.objects.create(
            action="SEGREGATION_EVENT",
            entity="Station",
            entity_id="STATION-01",
            metadata={
                'metal_detected': False,
                'metal_reading': 0,
                'moisture_value': 15.0,
                'moisture_detected': False,
                'predicted_category': 'Dry',
                'rule_applied': 'Residual category (neither metal nor moisture detected)',
                'status': 'Completed',
                'device_status': 'ONLINE'
            }
        )

        self.stdout.write(self.style.SUCCESS('\n======================================================='))
        self.stdout.write(self.style.SUCCESS('WasteGuard Demo Data Successfully Seeded!'))
        self.stdout.write(self.style.SUCCESS('Demo Accounts Available:'))
        self.stdout.write(self.style.SUCCESS('  1. ADMIN:          username="admin"          password="password123"'))
        self.stdout.write(self.style.SUCCESS('  2. SUPERVISOR:     username="supervisor"     password="password123"'))
        self.stdout.write(self.style.SUCCESS('  3. OPERATOR:       username="raj_sharma"     password="password123"'))
        self.stdout.write(self.style.SUCCESS('  4. VERIFICATION:   username="safety_officer" password="password123"'))
        self.stdout.write(self.style.SUCCESS('=======================================================\n'))

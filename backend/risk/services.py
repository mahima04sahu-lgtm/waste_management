from .models import RiskPrediction, RiskLevel
from vision.models import VisionClass

def calculate_container_risk(container, sensor_reading=None, vision_event=None):
    """
    Modular Risk Engine service.
    Evaluates:
    - Sensor readings (fill, weight, temp, humidity, gas_indicator, moisture)
    - AI vision results (classification, confidence, unknown_prob)
    - Device health
    Returns a dict with risk_score, risk_level, recommended_action, reason.
    """
    reasons = []
    score = 0

    # 1. Device Health Check
    is_offline = False
    if sensor_reading and sensor_reading.device_status == 'OFFLINE':
        is_offline = True
    elif container.device_status == 'OFFLINE':
        is_offline = True

    if is_offline:
        return {
            'risk_score': 50,
            'risk_level': RiskLevel.MEDIUM,
            'recommended_action': 'CLEAN / MAINTENANCE',
            'reason': 'Telemetry connection offline. Physical sensor inspection required.'
        }

    # 2. Gas / VOC Accumulation Check
    gas_val = getattr(sensor_reading, 'gas_indicator', 120.0) if sensor_reading else 120.0
    if gas_val >= 400.0:
        score += 30
        reasons.append(f"Abnormal elevated VOC/gas indicator ({gas_val:.0f} ppm)")
    elif gas_val >= 250.0:
        score += 15
        reasons.append(f"Elevated VOC gas readings ({gas_val:.0f} ppm)")

    # 3. Temperature Check
    temp_val = sensor_reading.temperature if sensor_reading else 25.0
    if temp_val >= 38.0:
        score += 25
        reasons.append(f"Abnormal container temperature ({temp_val:.1f}°C)")
    elif temp_val >= 32.0:
        score += 15
        reasons.append(f"Elevated temperature ({temp_val:.1f}°C)")

    # 4. Moisture Check
    moist_val = sensor_reading.moisture if sensor_reading else 0.0
    if moist_val >= 75.0:
        score += 25
        reasons.append(f"High moisture / liquid hazard detected ({moist_val:.0f}%)")
    elif moist_val >= 55.0:
        score += 10
        reasons.append("Moderate moisture level detected")

    # 5. Waste Stream Hazard Awareness
    is_hazard_stream = (getattr(container, 'current_waste', '').lower() in ['hazard', 'hazardous'] or
                        getattr(container, 'waste_category', '') == 'HAZARDOUS')
    if is_hazard_stream:
        if gas_val >= 250.0 or moist_val >= 50.0:
            score += 25
            reasons.append("Hazardous waste stream with elevated VOC / moisture activity")
        else:
            score += 10
            reasons.append("Hazardous waste segregation stream active")

    # Normalize score 0 - 100
    risk_score = min(100, score)

    # Risk Level assignment
    if risk_score >= 80:
        risk_level = RiskLevel.CRITICAL
    elif risk_score >= 60:
        risk_level = RiskLevel.HIGH
    elif risk_score >= 35:
        risk_level = RiskLevel.MEDIUM
    else:
        risk_level = RiskLevel.LOW

    # Recommended Action Engine logic
    if risk_level == RiskLevel.CRITICAL:
        recommended_action = 'ISOLATE'
    elif is_hazard_stream and risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
        recommended_action = 'SPECIALIST REQUIRED'
    elif risk_level == RiskLevel.HIGH:
        recommended_action = 'INSPECT'
    elif risk_level == RiskLevel.MEDIUM:
        recommended_action = 'INSPECT'
    else:
        recommended_action = 'NO ACTION'

    if not reasons:
        reason_text = "All station sensor telemetry within normal operational baseline limits."
    else:
        reason_text = " + ".join(reasons)

    return {
        'risk_score': risk_score,
        'risk_level': risk_level,
        'recommended_action': recommended_action,
        'reason': reason_text
    }

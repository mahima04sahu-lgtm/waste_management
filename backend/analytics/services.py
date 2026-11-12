"""
WasteGuard - Segregation and Station Analytics Services
"""

def get_segregation_summary(container):
    """
    Returns current segregation status summary for a given Container.
    """
    if not container:
        return {'status': 'UNKNOWN', 'proximity': False}

    reading = container.sensor_readings.first()
    return {
        'container_id': container.container_id,
        'current_waste': getattr(container, 'current_waste', 'Dry'),
        'waste_category': getattr(container, 'waste_category', 'DRY'),
        'proximity_detected': getattr(container, 'proximity_detected', False),
        'last_processed': getattr(container, 'last_processed', 'Recently'),
        'device_status': container.device_status,
        'temperature': reading.temperature if reading else None,

    }

from pathlib import Path
from django.conf import settings
import pandas as pd

_xgboost_model = None

FEATURE_COLS = [
    'fill_level_pct', 'waste_weight_kg', 'waste_added_kg', 'temperature_c',
    'humidity_pct', 'lid_open_count', 'hour_num', 'day_of_week_num',
    'waste_added_24h_kg', 'waste_added_7d_kg', 'avg_daily_waste_7d_kg',
    'avg_fill_7d_pct', 'fill_change_7d_pct_points', 'daily_fill_rate_pct_points',
    'hazard_level_encoded'
]

def get_xgboost_model():
    global _xgboost_model
    if _xgboost_model is None:
        try:
            import xgboost as xgb
            base_dir = Path(__file__).resolve().parent.parent
            model_path = base_dir / 'demo' / 'xgboost_waste_model.json'
            if model_path.exists():
                model = xgb.XGBRegressor()
                model.load_model(str(model_path))
                _xgboost_model = model
        except Exception as e:
            print(f"[XGBoost Load Warning] {e}")
    return _xgboost_model

def get_time_to_fill_prediction(container):
    """
    Returns time-to-80%-fill prediction dict for a given Container instance.
    """
    if not container:
        return {
            'predicted_hours': 0.0,
            'formatted': 'N/A',
            'threshold_reached': False
        }

    reading = container.sensor_readings.first()
    fill = float(reading.fill_level) if reading and reading.fill_level is not None else 45.0
    weight = float(reading.weight) if reading and reading.weight is not None else round(fill * 0.5, 1)
    temp = float(reading.temperature) if reading and reading.temperature is not None else 28.5
    humidity = float(reading.humidity) if reading and reading.humidity is not None else 60.0

    high_fill_threshold = getattr(settings, 'RISK_THRESHOLDS', {}).get('FILL_HIGH_PERCENT', 80.0)

    if fill >= high_fill_threshold:
        return {
            'predicted_hours': 0.0,
            'predicted_days': 0.0,
            'formatted': '0.0 hrs (80% Reached)',
            'threshold_reached': True
        }

    model = get_xgboost_model()
    pred_hours = 24.0

    if model:
        sample_dict = {
            'fill_level_pct': fill,
            'waste_weight_kg': weight,
            'waste_added_kg': 0.4,
            'temperature_c': temp,
            'humidity_pct': humidity,
            'lid_open_count': 6,
            'hour_num': 14,
            'day_of_week_num': 2,
            'waste_added_24h_kg': 4.2,
            'waste_added_7d_kg': 25.0,
            'avg_daily_waste_7d_kg': 3.5,
            'avg_fill_7d_pct': fill,
            'fill_change_7d_pct_points': 5.0,
            'daily_fill_rate_pct_points': 6.5,
            'hazard_level_encoded': 1
        }
        try:
            df_in = pd.DataFrame([sample_dict])[FEATURE_COLS]
            pred_hours = float(model.predict(df_in)[0])
            pred_hours = max(0.5, round(pred_hours, 1))
        except Exception as e:
            print(f"[Prediction Error] {e}")

    pred_days = round(pred_hours / 24.0, 1)
    formatted = f"{pred_hours} hrs"

    return {
        'predicted_hours': pred_hours,
        'predicted_days': pred_days,
        'formatted': formatted,
        'threshold_reached': False
    }

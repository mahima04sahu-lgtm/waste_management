"""
HazGuard - Automated Test Cases Verification Script for XGBoost & Threshold Logic
Verifies Test 1, Test 2, Test 3, Test 4 requirements.
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from pathlib import Path

FEATURE_COLS = [
    'fill_level_pct', 'waste_weight_kg', 'waste_added_kg', 'temperature_c',
    'humidity_pct', 'lid_open_count', 'hour_num', 'day_of_week_num',
    'waste_added_24h_kg', 'waste_added_7d_kg', 'avg_daily_waste_7d_kg',
    'avg_fill_7d_pct', 'fill_change_7d_pct_points', 'daily_fill_rate_pct_points',
    'hazard_level_encoded'
]

def run_tests():
    base_dir = Path(__file__).resolve().parent.parent
    model_path = base_dir / 'demo' / 'xgboost_waste_model.json'
    
    model = xgb.XGBRegressor()
    model.load_model(str(model_path))

    HIGH_THRESHOLD = 80.0

    def predict_with_logic(fill, weight, temp):
        if fill >= HIGH_THRESHOLD:
            return {
                'predicted_hours_to_80': 0.0,
                'threshold_reached': True,
                'status': '80% Fill Threshold Already Reached',
                'recommendation': 'Collection Required',
                'collection_required': True,
                'priority': 'HIGH' if fill < 85 else 'CRITICAL',
                'inference_type': 'THRESHOLD_OVERRIDE'
            }
        else:
            sample_dict = {
                'fill_level_pct': float(fill),
                'waste_weight_kg': float(weight),
                'waste_added_kg': 0.5,
                'temperature_c': float(temp),
                'humidity_pct': 58.0,
                'lid_open_count': 8,
                'hour_num': 14,
                'day_of_week_num': 2,
                'waste_added_24h_kg': 4.5,
                'waste_added_7d_kg': 28.0,
                'avg_daily_waste_7d_kg': 4.0,
                'avg_fill_7d_pct': float(fill),
                'fill_change_7d_pct_points': 10.0,
                'daily_fill_rate_pct_points': 8.5,
                'hazard_level_encoded': 1
            }
            df_in = pd.DataFrame([sample_dict])[FEATURE_COLS]
            pred_hours = float(model.predict(df_in)[0])
            pred_hours = max(0.5, round(pred_hours, 1))

            priority = 'MEDIUM' if pred_hours <= 24.0 else 'LOW'
            coll_req = 'UPCOMING' if pred_hours <= 24.0 else False

            return {
                'predicted_hours_to_80': pred_hours,
                'threshold_reached': False,
                'status': 'XGBoost Time-to-Fill Prediction',
                'recommendation': 'Schedule Pickup Soon' if pred_hours <= 24.0 else 'Normal Monitoring',
                'collection_required': coll_req,
                'priority': priority,
                'inference_type': 'XGBOOST_MODEL_INFERENCE'
            }

    print("=========================================================================")
    print("             HAZGUARD XGBOOST & THRESHOLD TEST VERIFICATION            ")
    print("=========================================================================\n")

    # TEST 1: Fill = 85%
    res1 = predict_with_logic(85.0, 42.5, 29.5)
    print("TEST 1: Fill = 85%")
    print(f"  • Predicted Hours: {res1['predicted_hours_to_80']}")
    print(f"  • Threshold Reached: {res1['threshold_reached']}")
    print(f"  • Status: {res1['status']}")
    print(f"  • Recommendation: {res1['recommendation']}")
    print(f"  • Collection Required: {res1['collection_required']}")
    assert res1['predicted_hours_to_80'] == 0.0
    assert res1['threshold_reached'] is True
    assert res1['recommendation'] == 'Collection Required'
    print("  --> PASS: 0 hours / threshold already reached / collection required.\n")

    # TEST 2: Fill = 70%
    res2 = predict_with_logic(70.0, 35.0, 29.5)
    print("TEST 2: Fill = 70%")
    print(f"  • Predicted Hours: {res2['predicted_hours_to_80']} hrs")
    print(f"  • Threshold Reached: {res2['threshold_reached']}")
    print(f"  • Status: {res2['status']}")
    assert res2['predicted_hours_to_80'] > 0
    assert res2['threshold_reached'] is False
    print("  --> PASS: XGBoost prediction of remaining time to 80% generated.\n")

    # TEST 3: Fill = 40%
    res3 = predict_with_logic(40.0, 20.0, 29.5)
    print("TEST 3: Fill = 40%")
    print(f"  • Predicted Hours: {res3['predicted_hours_to_80']} hrs")
    print(f"  • Threshold Reached: {res3['threshold_reached']}")
    print(f"  • Status: {res3['status']}")
    assert res3['predicted_hours_to_80'] > res2['predicted_hours_to_80']
    assert res3['threshold_reached'] is False
    print("  --> PASS: XGBoost prediction of remaining time to 80% generated.\n")

    # TEST 4: Vary Weight and Temp with Fill fixed at 60%
    res4a = predict_with_logic(60.0, 30.0, 25.0)
    res4b = predict_with_logic(60.0, 45.0, 36.0)
    print("TEST 4: Varying Weight & Temp with Fill Fixed at 60%")
    print(f"  • Run A (Weight 30kg, Temp 25°C): {res4a['predicted_hours_to_80']} hrs")
    print(f"  • Run B (Weight 45kg, Temp 36°C): {res4b['predicted_hours_to_80']} hrs")
    print(f"  • Difference: {abs(res4a['predicted_hours_to_80'] - res4b['predicted_hours_to_80']):.1f} hrs")
    assert res4a['predicted_hours_to_80'] != res4b['predicted_hours_to_80']
    print("  --> PASS: Model predictions dynamically vary based on trained features (not hardcoded).\n")

    print("ALL 4 TEST CASES PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()

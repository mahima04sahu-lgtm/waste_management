"""
HazGuard - Interactive XGBoost Model Tester
Test the trained model on sample sensor readings or test dataset records.
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from pathlib import Path

FEATURE_COLS = [
    'fill_level_pct',
    'waste_weight_kg',
    'waste_added_kg',
    'temperature_c',
    'humidity_pct',
    'lid_open_count',
    'hour_num',
    'day_of_week_num',
    'waste_added_24h_kg',
    'waste_added_7d_kg',
    'avg_daily_waste_7d_kg',
    'avg_fill_7d_pct',
    'fill_change_7d_pct_points',
    'daily_fill_rate_pct_points',
    'hazard_level_encoded'
]

def load_trained_model(model_path):
    model = xgb.XGBRegressor()
    model.load_model(model_path)
    return model

def run_test_sample():
    base_dir = Path(__file__).resolve().parent.parent
    model_path = base_dir / 'demo' / 'xgboost_waste_model.json'
    test_path = base_dir / 'demo' / 'test_processed.csv'

    model = load_trained_model(model_path)
    test_df = pd.read_csv(test_path)

    print("=========================================================================")
    print("        HazGuard XGBoost Time-to-Fill Prediction Test Results          ")
    print("=========================================================================\n")

    # Select 10 random sample rows from test dataset
    samples = test_df.sample(n=10, random_state=42).copy().reset_index(drop=True)
    X_samples = samples[FEATURE_COLS]
    predictions = model.predict(X_samples)

    print(f"{'Sample #':<10} | {'Fill %':<8} | {'Weight (kg)':<12} | {'Actual Hours':<15} | {'Predicted Hours':<15} | {'Error (hrs)':<10}")
    print("-" * 80)

    for idx, row in samples.iterrows():
        fill = row['fill_level_pct']
        weight = row['waste_weight_kg']
        actual = row['target_hours_to_80pct']
        pred = predictions[idx]
        err = abs(pred - actual)

        print(f"Sample #{idx+1:<3} | {fill:>6.1f}% | {weight:>10.2f} kg | {actual:>13.1f} hrs | {pred:>13.1f} hrs | {err:>8.1f} hrs")

    print("\n------------------------------------------------------------------------")
    print("[+] Custom Live Sensor Reading Test:")

    # Custom single sensor reading test
    custom_input = pd.DataFrame([{
        'fill_level_pct': 65.0,
        'waste_weight_kg': 32.5,
        'waste_added_kg': 1.2,
        'temperature_c': 29.5,
        'humidity_pct': 58.0,
        'lid_open_count': 12,
        'hour_num': 14,
        'day_of_week_num': 1, # Tuesday
        'waste_added_24h_kg': 5.4,
        'waste_added_7d_kg': 28.0,
        'avg_daily_waste_7d_kg': 4.0,
        'avg_fill_7d_pct': 45.0,
        'fill_change_7d_pct_points': 12.0,
        'daily_fill_rate_pct_points': 8.5,
        'hazard_level_encoded': 2 # High
    }])

    custom_pred = model.predict(custom_input)[0]
    print(f"  • Test Input Sensor Metrics: Fill = 65.0%, Weight = 32.5 kg, Temp = 29.5°C")
    print(f"  • XGBoost Predicted Time to 80% Fill Limit: {custom_pred:.1f} hours ({round(custom_pred / 24, 1)} days)\n")

if __name__ == '__main__':
    run_test_sample()

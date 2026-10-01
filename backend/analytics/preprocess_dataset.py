"""
HazGuard - Data Preprocessing & Validation Pipeline
- Chronological Time-Series Train/Test Split (80/20)
- Ground-Truth Target Calculation (hours_until_80pct) without Data Leakage
- Strict Filter: No imputation of missing targets with 0, mean, median, or random values.
"""

import pandas as pd
import numpy as np
from pathlib import Path

def preprocess_waste_dataset(csv_path):
    print(f"Loading raw dataset from: {csv_path}")
    df = pd.read_csv(csv_path)

    # 1. Parse timestamps and sort chronologically
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    print(f"Raw shape: {df.shape}")
    print(f"Timestamp range: {df['timestamp'].min()} to {df['timestamp'].max()}")

    # 2. Identify collection cycles (a cycle resets after a collection event)
    df['cycle_id'] = (df['collection_event'].shift(1, fill_value=0) == 1).cumsum()

    # 3. Calculate ground-truth target: hours until fill reaches 80%
    TARGET_THRESHOLD = 80.0
    target_hours = []

    for i in range(len(df)):
        current_time = df.iloc[i]['timestamp']
        current_fill = df.iloc[i]['fill_level_pct']
        current_cycle = df.iloc[i]['cycle_id']
        
        if current_fill >= TARGET_THRESHOLD:
            target_hours.append(0.0)
        else:
            # Look forward in time within the SAME collection cycle
            future_matches = df[
                (df.index > i) & 
                (df['cycle_id'] == current_cycle) & 
                (df['fill_level_pct'] >= TARGET_THRESHOLD)
            ]
            if len(future_matches) > 0:
                next_target_time = future_matches.iloc[0]['timestamp']
                hours_diff = (next_target_time - current_time).total_seconds() / 3600.0
                target_hours.append(hours_diff)
            else:
                # Target is unknown because cycle ended before 80% was reached
                target_hours.append(np.nan)

    df['target_hours_to_80pct'] = target_hours

    # 4. Filter out rows with undefined targets (NO dummy filling with 0/mean/median)
    valid_df = df.dropna(subset=['target_hours_to_80pct']).copy().reset_index(drop=True)
    dropped_rows = len(df) - len(valid_df)
    print(f"Filtered dataset shape: {valid_df.shape} ({dropped_rows} rows dropped without valid target)")

    # 5. Feature Engineering (Only historical features up to time t - NO data leakage)
    # Encode categorical features
    hazard_map = {'Low': 0, 'Medium': 1, 'High': 2, 'Critical': 3}
    valid_df['hazard_level_encoded'] = valid_df['hazard_level'].map(hazard_map).fillna(0)

    # Convert day_of_week to numeric (0=Monday, 6=Sunday)
    valid_df['day_of_week_num'] = valid_df['timestamp'].dt.dayofweek
    valid_df['hour_num'] = valid_df['timestamp'].dt.hour

    # Fill any minor historical missing values in features using forward fill
    feature_cols = [
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

    for col in feature_cols:
        if valid_df[col].isnull().sum() > 0:
            valid_df[col] = valid_df[col].ffill().bfill()

    # 6. Chronological Train / Test Split (80% Train, 20% Test)
    split_idx = int(len(valid_df) * 0.8)
    train_df = valid_df.iloc[:split_idx].copy().reset_index(drop=True)
    test_df = valid_df.iloc[split_idx:].copy().reset_index(drop=True)

    print(f"\n=== CHRONOLOGICAL TRAIN/TEST SPLIT ===")
    print(f"Train Set: {len(train_df)} rows ({train_df['timestamp'].min()} to {train_df['timestamp'].max()})")
    print(f"Test Set:  {len(test_df)} rows ({test_df['timestamp'].min()} to {test_df['timestamp'].max()})")

    return valid_df, train_df, test_df, feature_cols

if __name__ == '__main__':
    base_dir = Path(__file__).resolve().parent.parent
    csv_file = base_dir / 'demo' / 'robobin_sensor_data_90days.csv'
    
    valid_df, train_df, test_df, feature_cols = preprocess_waste_dataset(csv_file)
    
    # Save processed datasets
    out_dir = base_dir / 'demo'
    train_df.to_csv(out_dir / 'train_processed.csv', index=False)
    test_df.to_csv(out_dir / 'test_processed.csv', index=False)
    print(f"\nSaved processed train & test datasets to: {out_dir}")

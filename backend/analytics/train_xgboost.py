"""
HazGuard - XGBoost Time-to-Fill Model Training & Evaluation Pipeline
Trains an XGBRegressor model on processed chronological time-series sensor data.
"""

import pandas as pd
import numpy as np
from pathlib import Path
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

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

TARGET_COL = 'target_hours_to_80pct'

def train_and_evaluate():
    base_dir = Path(__file__).resolve().parent.parent
    train_path = base_dir / 'demo' / 'train_processed.csv'
    test_path = base_dir / 'demo' / 'test_processed.csv'
    model_path = base_dir / 'demo' / 'xgboost_waste_model.json'

    print(f"Loading training data from: {train_path}")
    train_df = pd.read_csv(train_path)
    test_df = pd.read_csv(test_path)

    X_train = train_df[FEATURE_COLS]
    y_train = train_df[TARGET_COL]

    X_test = test_df[FEATURE_COLS]
    y_test = test_df[TARGET_COL]

    print(f"Train features shape: {X_train.shape}, Test features shape: {X_test.shape}")

    # Initialize and train XGBoost Regressor
    model = xgb.XGBRegressor(
        n_estimators=150,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42
    )

    print("\nTraining XGBoost Regressor...")
    model.fit(X_train, y_train)

    # Predict on test set
    y_pred = model.predict(X_test)

    # Calculate Evaluation Metrics
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print("\n==========================================")
    print("   XGBoost Time-to-Fill Model Evaluation  ")
    print("==========================================")
    print(f"Mean Absolute Error (MAE): {mae:.2f} hours")
    print(f"Root Mean Squared Error (RMSE): {rmse:.2f} hours")
    print(f"R² Score (Variance Explained): {r2:.4f} ({round(r2 * 100, 2)}%)")
    print("==========================================\n")

    # Save model to disk
    model.save_model(model_path)
    print(f"Successfully saved trained XGBoost model to: {model_path}")

    # Feature Importance
    importance = model.feature_importances_
    feat_imp = pd.Series(importance, index=FEATURE_COLS).sort_values(ascending=False)
    print("\nTop Feature Importances:")
    for feat, imp in feat_imp.head(6).items():
        print(f"  • {feat}: {imp:.4f}")

    return model, mae, rmse, r2

if __name__ == '__main__':
    train_and_evaluate()

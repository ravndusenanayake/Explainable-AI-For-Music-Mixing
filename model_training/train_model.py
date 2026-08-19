import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import os

DATA_FILE = "training_data.csv"
MODEL_OUTPUT_PATH = "../backend/mix_model.pkl"

def train_model():
    if not os.path.exists(DATA_FILE):
        print(f"Error: {DATA_FILE} not found. Please run extract_features.py first.")
        return

    print("Loading training data...")
    df = pd.read_csv(DATA_FILE)
    
    # Feature columns
    feature_cols = ['vocal_rmsDb', 'inst_rmsDb', 'vocal_zcr', 'inst_zcr', 'vocal_crest', 'inst_crest']
    X = df[feature_cols]
    y_vocal_adj = df['vocal_adjustment_db']
    y_inst_adj = df['inst_adjustment_db']
    
    print("Splitting data...")
    X_train, X_test, y_train_vocal, y_test_vocal = train_test_split(X, y_vocal_adj, test_size=0.2, random_state=42)
    _, _, y_train_inst, y_test_inst = train_test_split(X, y_inst_adj, test_size=0.2, random_state=42)
    
    print("Training Random Forest Model for Vocal Gain...")
    rf_vocal = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf_vocal.fit(X_train, y_train_vocal)
    
    print("Training Random Forest Model for Instrumental Gain...")
    rf_inst = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf_inst.fit(X_train, y_train_inst)
    
    # Evaluation
    vocal_preds = rf_vocal.predict(X_test)
    inst_preds = rf_inst.predict(X_test)
    
    print("\n--- Evaluation Results ---")
    print(f"Vocal Gain R2 Score: {r2_score(y_test_vocal, vocal_preds):.3f}")
    print(f"Vocal Gain RMSE: {np.sqrt(mean_squared_error(y_test_vocal, vocal_preds)):.3f} dB")
    
    print(f"Instrumental Gain R2 Score: {r2_score(y_test_inst, inst_preds):.3f}")
    print(f"Instrumental Gain RMSE: {np.sqrt(mean_squared_error(y_test_inst, inst_preds)):.3f} dB")
    
    print("\nFeature Importances (Vocal Model):")
    for name, imp in zip(feature_cols, rf_vocal.feature_importances_):
        print(f"  {name}: {imp:.3f}")
        
    # Save the models
    os.makedirs(os.path.dirname(MODEL_OUTPUT_PATH), exist_ok=True)
    print(f"\nSaving models to {MODEL_OUTPUT_PATH}...")
    joblib.dump({
        'vocal_model': rf_vocal, 
        'inst_model': rf_inst, 
        'features': feature_cols
    }, MODEL_OUTPUT_PATH)
    
    print("Training complete! Model is ready for the Node.js backend.")

if __name__ == "__main__":
    train_model()

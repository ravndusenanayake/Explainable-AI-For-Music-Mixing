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
    X = df[feature_cols].fillna(0)
    
    print("Generating Reverb and Delay targets based on heuristics...")
    # Reverb Target: More dynamic (high crest) -> less reverb. Less dynamic -> more reverb.
    df['target_reverb'] = df['vocal_crest'].apply(lambda c: min(40.0, max(10.0, 35.0 - c)))
    # Delay Target: High ZCR (sharp vocals) -> more delay to soften.
    df['target_delay'] = df['vocal_zcr'].apply(lambda z: min(30.0, max(5.0, z * 200)))
    
    # Target columns for the multi-output model: (Vocal Gain, Reverb Mix, Delay Mix)
    y = df[['vocal_adjustment_db', 'target_reverb', 'target_delay']]
    
    print("Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Multi-Output Random Forest Model...")
    rf_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)
    
    # Evaluation
    preds = rf_model.predict(X_test)
    
    print("\n--- Evaluation Results ---")
    print(f"Overall R2 Score: {r2_score(y_test, preds):.3f}")
    
    print("\nFeature Importances:")
    for name, imp in zip(feature_cols, rf_model.feature_importances_):
        print(f"  {name}: {imp:.3f}")
        
    # Save the model matching predict.py expectations
    os.makedirs(os.path.dirname(MODEL_OUTPUT_PATH), exist_ok=True)
    print(f"\nSaving multi-output model to {MODEL_OUTPUT_PATH}...")
    joblib.dump({
        'model': rf_model, 
        'features': feature_cols
    }, MODEL_OUTPUT_PATH)
    
    print("Training complete! Model is ready for the Node.js backend.")

if __name__ == "__main__":
    train_model()

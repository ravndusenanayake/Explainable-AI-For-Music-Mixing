import sys
import json
import joblib
import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "mix_model.pkl")

# Basic XAI Logic mapping features to plain English explanations
FEATURE_TO_EXPLANATION = {
    'vocal_rmsDb': 'Vocal average loudness',
    'inst_rmsDb': 'Instrumental average loudness',
    'vocal_zcr': 'Vocal brightness/sibilance',
    'inst_zcr': 'Instrumental brightness',
    'vocal_crest': 'Vocal dynamics (loud peaks)',
    'inst_crest': 'Instrumental dynamics'
}

def predict():
    try:
        # Check if model exists
        if not os.path.exists(MODEL_PATH):
            print(json.dumps({"error": "Model not trained yet."}))
            return

        # Load model
        model_data = joblib.load(MODEL_PATH)
        rf_vocal = model_data['vocal_model']
        rf_inst = model_data['inst_model']
        feature_names = model_data['features']

        # Read JSON input from stdin or argument
        if len(sys.argv) < 2:
            print(json.dumps({"error": "Missing input data."}))
            return
            
        input_data = json.loads(sys.argv[1])
        
        # Prepare feature array
        X_input = []
        for feature in feature_names:
            X_input.append(input_data.get(feature, 0.0))
            
        X_input = np.array([X_input])
        
        # Predict gain adjustments
        vocal_gain = rf_vocal.predict(X_input)[0]
        inst_gain = rf_inst.predict(X_input)[0]
        
        # Explainable AI Logic (Simplified for skeleton)
        # Find the feature that pushed the decision the most (using model feature importances as proxy)
        top_feature_idx = np.argmax(rf_vocal.feature_importances_)
        top_feature = feature_names[top_feature_idx]
        reason_text = f"AI decision driven heavily by {FEATURE_TO_EXPLANATION.get(top_feature, top_feature)}."
        
        result = {
            "success": True,
            "vocalGainDb": float(vocal_gain),
            "instrumentalGainDb": float(inst_gain),
            "severity": "adjusted" if abs(vocal_gain) > 2 or abs(inst_gain) > 2 else "optimal",
            "explanations": [
                {
                    "action": f"ML Predicted Gain: Vocal {vocal_gain:+.1f}dB, Inst {inst_gain:+.1f}dB",
                    "reason": reason_text,
                    "tip": "This decision was made by the Random Forest model trained on MUSDB18-HQ."
                }
            ]
        }
        
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()

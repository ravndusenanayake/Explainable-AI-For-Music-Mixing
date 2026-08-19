import sys
import json
import joblib
import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "mix_model.pkl")

# Basic XAI Logic mapping features to plain English explanations
FEATURE_TO_EXPLANATION = {
    'vocal_rmsDb': 'the overall average loudness of the vocals',
    'inst_rmsDb': 'the overall loudness of the background beat',
    'vocal_zcr': 'the high-frequency brightness (sibilance) of the vocals',
    'inst_zcr': 'the high-frequency brightness of the background beat',
    'vocal_crest': 'the sudden loud dynamic peaks in the vocals',
    'inst_crest': 'the sudden loud dynamic peaks in the background beat'
}

TIPS = {
    'vocal_rmsDb': 'Try using a Volume Automation or Gain plugin if the vocals still feel too quiet overall.',
    'inst_rmsDb': 'You can manually lower the beat volume a bit more if the vocals are still struggling to cut through.',
    'vocal_zcr': 'If the vocals sound too harsh or piercing, try using a De-Esser or an EQ to cut the high frequencies.',
    'inst_zcr': 'If the beat sounds too bright and distracts from the vocal, a high-cut filter (EQ) can make it smoother.',
    'vocal_crest': 'A Compressor will help tame those sudden loud vocal peaks so they stay perfectly balanced!',
    'inst_crest': 'Consider using a Limiter on the beat to control the sudden volume spikes.'
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
            
        if sys.argv[1] == '--file' and len(sys.argv) > 2:
            with open(sys.argv[2], 'r') as f:
                input_data = json.load(f)
        else:
            input_data = json.loads(sys.argv[1])
        
        # Prepare feature array
        X_input = []
        for feature in feature_names:
            X_input.append(input_data.get(feature, 0.0))
            
        X_input = np.array([X_input])
        
        # Predict gain adjustments
        vocal_gain = rf_vocal.predict(X_input)[0]
        inst_gain = rf_inst.predict(X_input)[0]
        
        # Explainable AI Logic
        top_feature_idx = np.argmax(rf_vocal.feature_importances_)
        top_feature = feature_names[top_feature_idx]
        reason_text = f"The AI mainly based this decision on {FEATURE_TO_EXPLANATION.get(top_feature, top_feature)}."
        tip_text = TIPS.get(top_feature, "Trust your ears! The AI provides a starting point, but you can tweak it further.")

        vocal_action = f"Reduced vocal volume by {abs(vocal_gain):.1f} dB" if vocal_gain < 0 else f"Increased vocal volume by {vocal_gain:.1f} dB"
        inst_action = f"reduced beat volume by {abs(inst_gain):.1f} dB" if inst_gain < 0 else f"increased beat volume by {inst_gain:.1f} dB"

        if abs(vocal_gain) < 0.1 and abs(inst_gain) < 0.1:
            action_text = "Kept both volumes perfectly the same."
            reason_text = "The AI analyzed the audio and found that the mix was already well balanced."
            tip_text = "Great job on your recording/production levels!"
        else:
            action_text = f"{vocal_action} and {inst_action}."

        # AI DSP Recommendations
        vocal_reverb_mix = 0.0
        vocal_delay_mix = 0.0
        
        # Intelligent mapping based on audio features
        vocal_loudness = input_data.get('vocal_rmsDb', -20)
        vocal_zcr = input_data.get('vocal_zcr', 0.05)
        
        if vocal_loudness < -18:
            vocal_reverb_mix = 0.25 # 25% reverb if quiet/intimate
        else:
            vocal_reverb_mix = 0.15 # 15% reverb if loud/aggressive
            
        if vocal_zcr > 0.07:
            vocal_delay_mix = 0.15 # 15% delay if bright (pop style)
        else:
            vocal_delay_mix = 0.05
            
        explanations_list = [
            {
                "action": action_text,
                "reason": reason_text,
                "tip": tip_text
            }
        ]
        
        if vocal_reverb_mix > 0:
            explanations_list.append({
                "action": f"Applied {int(vocal_reverb_mix*100)}% Reverb to the Vocals.",
                "reason": "The vocal needed some 3D acoustic space to sit beautifully in the mix.",
                "tip": "Reverb makes the singer sound like they are in a real room or hall."
            })
            
        if vocal_delay_mix > 0.1:
            explanations_list.append({
                "action": f"Applied {int(vocal_delay_mix*100)}% Echo (Delay) to the Vocals.",
                "reason": "The vocal was very bright, so a slapback delay helps thicken the sound.",
                "tip": "Delay adds rhythm and depth without muddying the mix like too much reverb can."
            })

        result = {
            "success": True,
            "vocalGainDb": float(vocal_gain),
            "instrumentalGainDb": float(inst_gain),
            "vocalReverbMix": float(vocal_reverb_mix),
            "vocalDelayMix": float(vocal_delay_mix),
            "severity": "adjusted" if abs(vocal_gain) > 2 or abs(inst_gain) > 2 else "optimal",
            "explanations": explanations_list
        }
        
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()

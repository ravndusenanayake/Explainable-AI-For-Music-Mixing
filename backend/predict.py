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
        model = model_data['model']
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

        # Extract features in the exact order they were trained
        feature_values = []
        for feat in feature_names:
            val = input_data.get(feat, 0.0)
            if val is None:
                val = 0.0
            feature_values.append(val)

        X_infer = np.array([feature_values])

        # Predict
        predictions = model.predict(X_infer)[0]
        v_gain = predictions[0]
        reverb_mix = predictions[1]
        delay_mix = predictions[2]

        explanations = []
        severity = 'optimal'

        if abs(v_gain) > 3:
            severity = 'significant'
        elif abs(v_gain) > 1:
            severity = 'adjusted'

        if v_gain > 0.5:
            explanations.append({
                "action": f"Boosted vocal by +{v_gain:.1f}dB",
                "reason": f"The vocals were too quiet compared to the beat.",
                "tip": TIPS.get('vocal_rmsDb', '')
            })
        elif v_gain < -0.5:
            explanations.append({
                "action": f"Cut vocal by {v_gain:.1f}dB",
                "reason": "The vocals were overpowering the instrumental track.",
                "tip": TIPS.get('inst_rmsDb', '')
            })

        # XAI for Reverb & Delay
        tempo = input_data.get('tempo_bpm', 120)
        explanations.append({
            "action": f"Set Reverb to {reverb_mix:.0f}%",
            "reason": f"Because the song tempo is {tempo:.0f} BPM, this amount of reverb fills the space perfectly without muddying the mix.",
            "tip": "Slower songs sound great with more reverb. Fast songs need less."
        })
        explanations.append({
            "action": f"Set Delay to {delay_mix:.0f}%",
            "reason": f"Matched the delay level to compliment the vocal dynamics.",
            "tip": "Delay adds a professional echo effect synced to the beat."
        })

        result = {
            "success": True,
            "vocalGainDb": float(v_gain),
            "instrumentalGainDb": 0.0,
            "reverbMix": float(reverb_mix),
            "delayMix": float(delay_mix),
            "severity": severity,
            "explanations": explanations
        }
        
        print(json.dumps(result))

    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))

if __name__ == '__main__':
    predict()

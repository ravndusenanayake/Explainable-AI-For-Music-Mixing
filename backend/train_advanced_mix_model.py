import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
import os

print("Start Training Advanced XAI Mix Model...")

# 1. GENERATE SYNTHETIC DATASET
# Features: vocal_rmsDb, inst_rmsDb, vocal_zcr, inst_zcr, vocal_crest, tempo_bpm
# Targets: vocalGainDb, reverbMix, delayMix

np.random.seed(42)
num_samples = 2000

vocal_rmsDb = np.random.uniform(-30, -5, num_samples)
inst_rmsDb = np.random.uniform(-25, -5, num_samples)
vocal_zcr = np.random.uniform(0.01, 0.15, num_samples)
inst_zcr = np.random.uniform(0.05, 0.20, num_samples)
vocal_crest = np.random.uniform(2, 10, num_samples)
tempo_bpm = np.random.uniform(60, 160, num_samples) # 60=Slow, 160=Fast

# Target generation logic (how a human would mix):
# Vocal Gain: aim to make Vocal RMS slightly louder than Inst RMS (-2dB diff)
vocalGainDb = (inst_rmsDb - 2.0) - vocal_rmsDb

# Reverb: Slow songs (60-90 BPM) get more Reverb (30-40%), Fast songs get less (10-20%)
reverbMix = np.clip(50 - (tempo_bpm - 60) * 0.3, 10, 45)
# Add some randomness based on crest factor (more dynamic vocals get slightly less reverb to stay clear)
reverbMix -= (vocal_crest * 0.5)

# Delay: Slower songs get more delay mix. 
delayMix = np.clip(30 - (tempo_bpm - 60) * 0.2, 5, 25)

X = pd.DataFrame({
    'vocal_rmsDb': vocal_rmsDb,
    'inst_rmsDb': inst_rmsDb,
    'vocal_zcr': vocal_zcr,
    'inst_zcr': inst_zcr,
    'vocal_crest': vocal_crest,
    'tempo_bpm': tempo_bpm
})

Y = pd.DataFrame({
    'vocalGainDb': vocalGainDb,
    'reverbMix': reverbMix,
    'delayMix': delayMix
})

print(f"Generated {num_samples} rows of training data.")

# 2. TRAIN THE RANDOM FOREST MODEL
print("Training Random Forest Model...")
model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
model.fit(X, Y)

# 3. SAVE THE MODEL
output_path = os.path.join(os.path.dirname(__file__), "mix_model.pkl")

model_data = {
    'model': model,
    'features': list(X.columns)
}
joblib.dump(model_data, output_path)

print(f"Training Complete! Model saved to {output_path}")

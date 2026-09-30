import numpy as np
import librosa
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

print("==================================================")
print("Explainable AI: Training Custom Table Tap Detector")
print("==================================================")

# 1. Synthesize Dataset
print("[1/4] Generating Custom Dataset (Vocals vs Table Taps)...")
np.random.seed(42)

def generate_vocal_sample(sr=22050, duration=0.5):
    # Vocals have harmonic structures (fundamental freq + harmonics)
    t = np.linspace(0, duration, int(sr * duration))
    f0 = np.random.uniform(100, 300)
    audio = np.sin(2 * np.pi * f0 * t) + 0.5 * np.sin(2 * np.pi * 2 * f0 * t)
    # Add vibrato
    audio *= np.sin(2 * np.pi * 5 * t)
    return audio

def generate_tap_sample(sr=22050, duration=0.5):
    # Table taps are impulsive, broad-spectrum transients (white noise burst with quick decay)
    t = np.linspace(0, duration, int(sr * duration))
    noise = np.random.normal(0, 1, len(t))
    decay = np.exp(-t * 50) # Very fast decay
    audio = noise * decay
    return audio

# Generate 500 samples of each
X_audio = []
y = []

for _ in range(500):
    X_audio.append(generate_vocal_sample())
    y.append(0) # 0 = Vocal

for _ in range(500):
    X_audio.append(generate_tap_sample())
    y.append(1) # 1 = Table Tap

print(f"Generated {len(y)} audio samples for training.")

# 2. Extract Features (MFCCs)
print("[2/4] Extracting Audio Features (MFCCs) for AI processing...")
X_features = []
for audio in X_audio:
    # Extract Mel-frequency cepstral coefficients (13 coefficients)
    mfcc = librosa.feature.mfcc(y=audio, sr=22050, n_mfcc=13)
    # Take the mean across time to get a single feature vector per sample
    mfcc_mean = np.mean(mfcc, axis=1)
    X_features.append(mfcc_mean)

X = np.array(X_features)
y = np.array(y)

# 3. Train Machine Learning Model
print("[3/4] Training Random Forest Classifier...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
clf.fit(X_train, y_train)

# Evaluate
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"Model Accuracy on Test Data: {accuracy * 100:.2f}%")

# 4. Save Model
print("[4/4] Saving trained model to disk...")
model_path = os.path.join(os.path.dirname(__file__), 'tap_detector_model.pkl')
joblib.dump(clf, model_path)

print("[SUCCESS] Custom AI Model Training Complete!")
print(f"Model saved at: {model_path}")
print("This model can now be used in the backend to detect and remove table taps in real-time.")

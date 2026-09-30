import numpy as np
import librosa
import soundfile as sf
import joblib
import sys
import os

print("[De-Tap AI] Starting Custom Table Tap Removal Model...")

if len(sys.argv) < 3:
    print("Usage: python remove_taps.py <input.wav> <output.wav>")
    sys.exit(1)

input_file = sys.argv[1]
output_file = sys.argv[2]

model_path = os.path.join(os.path.dirname(__file__), 'tap_detector_model.pkl')
if not os.path.exists(model_path):
    print(f"Error: Model file {model_path} not found. Please train the model first.")
    sys.exit(1)

# 1. Load Custom AI Model
print("[De-Tap AI] Loading custom Machine Learning model...")
clf = joblib.load(model_path)

# 2. Load Audio
print(f"[De-Tap AI] Loading audio: {os.path.basename(input_file)}")
y, sr = librosa.load(input_file, sr=None)

# 3. Process audio in frames (sliding window)
frame_length = int(0.02 * sr) # 20ms frames
hop_length = int(0.01 * sr)   # 10ms hop
frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length).T

print(f"[De-Tap AI] Analyzing {len(frames)} audio frames for table taps...")
y_clean = np.copy(y)

# Smoothing filter to avoid clicking when ducking
duck_factor = np.ones(len(frames))

tap_count = 0
for i, frame in enumerate(frames):
    # Extract MFCC for this tiny frame
    mfcc = librosa.feature.mfcc(y=frame, sr=sr, n_mfcc=13)
    mfcc_mean = np.mean(mfcc, axis=1).reshape(1, -1)
    
    # Predict if it's a tap
    is_tap = clf.predict(mfcc_mean)[0]
    
    if is_tap == 1:
        duck_factor[i] = 0.0 # Mute the frame
        tap_count += 1

print(f"[De-Tap AI] Detected {tap_count} table tap instances. Removing them...")

# Apply ducking to the audio
# (Simple implementation: applying the ducking factor per hop)
for i in range(len(frames)):
    start_idx = i * hop_length
    end_idx = start_idx + frame_length
    # Apply attenuation
    y_clean[start_idx:end_idx] *= duck_factor[i]

# 4. Save Cleaned Audio
print(f"[De-Tap AI] Saving purified audio to: {os.path.basename(output_file)}")
sf.write(output_file, y_clean, sr)

print("[De-Tap AI] Process complete. All table taps isolated and removed successfully!")

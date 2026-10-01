import numpy as np
import librosa
import soundfile as sf
import sys
import os

print("[Advanced AI] Starting Harmonic-Percussive Source Separation (HPSS)...")

if len(sys.argv) < 3:
    print("Usage: python remove_taps.py <input.wav> <output.wav>")
    sys.exit(1)

input_file = sys.argv[1]
output_file = sys.argv[2]

# 1. Load Audio
print(f"[Advanced AI] Loading audio for deep transient analysis: {os.path.basename(input_file)}")
y, sr = librosa.load(input_file, sr=None)

# 2. Apply Harmonic-Percussive Source Separation
# Table taps are highly 'percussive' (vertical energy in spectrogram). 
# Voice is highly 'harmonic' (horizontal energy in spectrogram).
print("[Advanced AI] Decomposing spectrogram into Harmonic and Percussive components...")
# margin > 1.0 increases the separation quality, pushing more energy into the percussive stem
harmonic, percussive = librosa.effects.hpss(y, margin=(1.0, 5.0))

# The 'harmonic' component now contains the smooth vocals, minus the sharp table taps!
# But to preserve some naturalness, we can keep a tiny bit of the percussive track (so consonants like 'T' and 'P' aren't totally lost),
# but heavily attenuate it. Let's do a smart ducking: where percussive energy is extreme, we duck it.

# Calculate the envelope of the percussive component
perc_envelope = np.abs(librosa.core.stft(percussive))
rms_perc = librosa.feature.rms(S=perc_envelope)[0]

# Normalize RMS to find the loudest taps
rms_norm = rms_perc / (np.max(rms_perc) + 1e-6)

# Interpolate the low-res RMS back to original audio length
rms_full = np.interp(np.arange(len(y)), np.linspace(0, len(y), len(rms_norm)), rms_norm)

# Create a dynamic transient mask (if percussive energy is high, reduce volume)
# Threshold: 0.1 (taps are usually loud spikes)
mask = np.ones_like(y)
mask[rms_full > 0.15] = 0.1  # Squashes the loud table taps by 90%

# Combine: We take the original audio, apply the transient mask to kill the table taps,
# and use a slight blend of the harmonic track to ensure the vocal stays smooth.
y_clean = y * mask

# To be even safer and cleaner, we just output the pure Harmonic stem (which inherently lacks taps)
# blended with 50% of the masked original to preserve natural vocal consonants.
y_final = (harmonic * 0.8) + (y_clean * 0.2)

# 4. Save Cleaned Audio
print(f"[Advanced AI] Rendering purified studio audio to: {os.path.basename(output_file)}")
sf.write(output_file, y_final, sr)

print("[Advanced AI] Process complete. Impulsive transients (table taps) removed using HPSS!")

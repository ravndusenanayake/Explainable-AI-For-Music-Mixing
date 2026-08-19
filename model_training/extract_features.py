import os
import glob
import librosa
import numpy as np
import pandas as pd
import warnings

warnings.filterwarnings('ignore')

# CONSTANTS
SEGMENT_DURATION = 4.0 # 4 seconds to match the Node.js backend
SAMPLE_RATE = 44100
DATASET_PATH = r"C:\Explainable Music Mixing AI\dataset" 

def calculate_rms(audio_data):
    if len(audio_data) == 0: return 0
    return np.sqrt(np.mean(audio_data**2))

def linear_to_db(value):
    if value <= 0: return -100
    return 20 * np.log10(value)

def calculate_zcr(audio_data):
    if len(audio_data) == 0: return 0
    return np.mean(librosa.feature.zero_crossing_rate(audio_data)[0])

def calculate_crest_factor(audio_data, rms):
    if rms == 0: return 0
    peak = np.max(np.abs(audio_data))
    return peak / rms

def extract_features_and_labels():
    print(f"Searching for songs in {DATASET_PATH}...")
    
    dataset_records = []
    
    # Assuming MUSDB18-HQ folder structure where each song is a directory containing the stems
    song_dirs = [d for d in glob.glob(os.path.join(DATASET_PATH, "*", "*")) if os.path.isdir(d)]
    
    # If standard MUSDB18-HQ, it's usually train/song_name and test/song_name
    if not song_dirs:
        song_dirs = [d for d in glob.glob(os.path.join(DATASET_PATH, "*")) if os.path.isdir(d)]
        
    print(f"Found {len(song_dirs)} songs. Starting extraction...")

    for i, song_dir in enumerate(song_dirs):
        print(f"Processing [{i+1}/{len(song_dirs)}]: {os.path.basename(song_dir)}")
        
        vocal_path = os.path.join(song_dir, "vocals.wav")
        drums_path = os.path.join(song_dir, "drums.wav")
        bass_path = os.path.join(song_dir, "bass.wav")
        other_path = os.path.join(song_dir, "other.wav")
        mixture_path = os.path.join(song_dir, "mixture.wav")
        
        if not all(os.path.exists(p) for p in [vocal_path, drums_path, bass_path, other_path, mixture_path]):
            print(f"Skipping {song_dir} due to missing stems.")
            continue
            
        # Load audio (mono for simpler feature extraction)
        vocal, sr = librosa.load(vocal_path, sr=SAMPLE_RATE, mono=True)
        drums, _ = librosa.load(drums_path, sr=SAMPLE_RATE, mono=True)
        bass, _ = librosa.load(bass_path, sr=SAMPLE_RATE, mono=True)
        other, _ = librosa.load(other_path, sr=SAMPLE_RATE, mono=True)
        mixture, _ = librosa.load(mixture_path, sr=SAMPLE_RATE, mono=True)
        
        # Combine instrumental
        inst = drums + bass + other
        
        # Process in segments
        segment_samples = int(SEGMENT_DURATION * sr)
        num_segments = len(mixture) // segment_samples
        
        for seg_idx in range(num_segments):
            start = seg_idx * segment_samples
            end = start + segment_samples
            
            v_seg = vocal[start:end]
            i_seg = inst[start:end]
            m_seg = mixture[start:end]
            
            v_rms = calculate_rms(v_seg)
            i_rms = calculate_rms(i_seg)
            
            # Skip silent segments
            if v_rms < 0.005 and i_rms < 0.005:
                continue
                
            # --- FEATURE EXTRACTION ---
            v_zcr = calculate_zcr(v_seg)
            i_zcr = calculate_zcr(i_seg)
            
            v_crest = calculate_crest_factor(v_seg, v_rms)
            i_crest = calculate_crest_factor(i_seg, i_rms)
            
            # --- LABEL CALCULATION (Target Gain Adjustment) ---
            # Using Least Squares to find the exact gain applied to vocal and instrumental to match the mixture
            # m_seg ≈ (v_gain * v_seg) + (i_gain * i_seg)
            try:
                A = np.vstack([v_seg, i_seg]).T
                gains, _, _, _ = np.linalg.lstsq(A, m_seg, rcond=None)
                v_gain, i_gain = gains[0], gains[1]
                
                # Convert linear gain to dB adjustment
                # If gain is very small or negative, cap it
                v_gain = max(v_gain, 0.01)
                i_gain = max(i_gain, 0.01)
                
                v_adj_db = linear_to_db(v_gain)
                i_adj_db = linear_to_db(i_gain)
                
                # Cap extreme adjustments
                v_adj_db = np.clip(v_adj_db, -24, 24)
                i_adj_db = np.clip(i_adj_db, -24, 24)
                
                dataset_records.append({
                    'song': os.path.basename(song_dir),
                    'segment': seg_idx,
                    'vocal_rmsDb': linear_to_db(v_rms),
                    'inst_rmsDb': linear_to_db(i_rms),
                    'vocal_zcr': v_zcr,
                    'inst_zcr': i_zcr,
                    'vocal_crest': v_crest,
                    'inst_crest': i_crest,
                    'vocal_adjustment_db': v_adj_db,
                    'inst_adjustment_db': i_adj_db
                })
            except Exception as e:
                pass
                
    df = pd.DataFrame(dataset_records)
    csv_path = "training_data.csv"
    df.to_csv(csv_path, index=False)
    print(f"Extraction complete! Saved {len(df)} records to {csv_path}")

if __name__ == "__main__":
    extract_features_and_labels()

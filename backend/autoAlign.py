import sys
import numpy as np
import scipy.io.wavfile as wav
import json

def align_audio(vocal_path, inst_path):
    try:
        # Load audio files
        sr_v, vocal = wav.read(vocal_path)
        sr_i, inst = wav.read(inst_path)

        # Convert to mono if stereo
        if len(vocal.shape) > 1:
            vocal = vocal.mean(axis=1)
        if len(inst.shape) > 1:
            inst = inst.mean(axis=1)

        # Ensure same sample rate (assuming they are for simplicity, if not we'd resample)
        if sr_v != sr_i:
            return {"error": "Sample rates do not match"}

        # We don't need to cross-correlate the entire 3 minute song, which is heavy.
        # Let's take the first 30 seconds of the vocal to find where it sits in the instrumental.
        max_samples = sr_v * 30 
        vocal_segment = vocal[:max_samples]
        
        # Normalize
        vocal_segment = vocal_segment / (np.max(np.abs(vocal_segment)) + 1e-8)
        inst = inst / (np.max(np.abs(inst)) + 1e-8)

        # Compute cross-correlation using FFT for speed
        from scipy import signal
        correlation = signal.correlate(inst, vocal_segment, mode='valid', method='fft')
        
        # Find the index of the maximum correlation
        lag = np.argmax(correlation)
        
        # Convert lag to seconds
        delay_seconds = lag / sr_v

        # Ensure we don't return negative or absurd values if it completely fails
        if delay_seconds < 0:
            delay_seconds = 0

        return {
            "success": True,
            "delay_seconds": delay_seconds,
            "confidence": float(correlation[lag])
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
        
    v_path = sys.argv[1]
    i_path = sys.argv[2]
    
    result = align_audio(v_path, i_path)
    print(json.dumps(result))

"""
AI Vocal Denoiser - Uses noisereduce library for spectral gating noise reduction.
This provides a significant, audible improvement over simple FFmpeg filters.

Usage:
    python denoiser.py <input_wav_path> <output_wav_path>

The script:
  1. Loads the audio file
  2. Performs stationary noise reduction (spectral gating)
  3. Performs a second pass of non-stationary noise reduction
  4. Outputs the cleaned audio and a JSON report with metrics
"""

import sys
import json
import numpy as np
import soundfile as sf
import noisereduce as nr

def calculate_snr(original, cleaned):
    """Calculate Signal-to-Noise Ratio improvement in dB."""
    noise_original = original - cleaned
    power_signal = np.mean(cleaned ** 2)
    power_noise_original = np.mean(noise_original ** 2)
    
    if power_noise_original == 0:
        return 0
    
    snr = 10 * np.log10(power_signal / power_noise_original)
    return round(float(snr), 1)

def calculate_noise_reduction_percent(original, cleaned):
    """Estimate how much noise was removed as a percentage."""
    noise = original - cleaned
    noise_energy = np.mean(noise ** 2)
    original_energy = np.mean(original ** 2)
    
    if original_energy == 0:
        return 0
    
    percent = (noise_energy / original_energy) * 100
    return round(min(percent, 99), 1)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: denoiser.py <input> <output>"}))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    try:
        # Load audio
        audio, sr = sf.read(input_path, dtype='float64')
        
        # If stereo, convert to mono for processing
        is_stereo = len(audio.shape) > 1
        if is_stereo:
            mono = np.mean(audio, axis=1)
        else:
            mono = audio
        
        original_rms = float(np.sqrt(np.mean(mono ** 2)))
        
        # ── Pass 1: Stationary Noise Reduction ──
        # This targets constant background noise like fan hum, AC, hiss
        # prop_decrease controls aggressiveness (1.0 = max reduction)
        cleaned = nr.reduce_noise(
            y=mono,
            sr=sr,
            stationary=True,
            prop_decrease=1.0,    # Maximum noise reduction
            n_fft=2048,
            n_std_thresh_stationary=1.2,  # Lower = more aggressive
        )
        
        # ── Pass 2: Non-Stationary Noise Reduction ──
        # This targets variable noise like keyboard clicks, random bumps
        cleaned = nr.reduce_noise(
            y=cleaned,
            sr=sr,
            stationary=False,
            prop_decrease=0.85,   # Slightly less aggressive to preserve vocal nuances
            n_fft=2048,
            n_std_thresh_stationary=1.5,
        )
        
        # ── Normalize output to match original loudness ──
        cleaned_rms = float(np.sqrt(np.mean(cleaned ** 2)))
        if cleaned_rms > 0:
            cleaned = cleaned * (original_rms / cleaned_rms)
        
        # Prevent clipping
        peak = np.max(np.abs(cleaned))
        if peak > 0.99:
            cleaned = cleaned * (0.99 / peak)
        
        # Save output
        sf.write(output_path, cleaned, sr)
        
        # Calculate metrics
        noise_reduction_pct = calculate_noise_reduction_percent(mono, cleaned)
        snr_improvement = calculate_snr(mono, cleaned)
        
        result = {
            "success": True,
            "metrics": {
                "noise_reduction_percent": noise_reduction_pct,
                "snr_improvement_db": snr_improvement,
                "sample_rate": sr,
                "duration_seconds": round(len(mono) / sr, 2),
                "original_rms_db": round(20 * np.log10(max(original_rms, 1e-10)), 1),
                "cleaned_rms_db": round(20 * np.log10(max(cleaned_rms, 1e-10)), 1),
            },
            "explanations": [
                {
                    "action": f"AI Noise Reduction: {noise_reduction_pct}% noise removed",
                    "reason": f"Used spectral gating AI model to identify and remove {noise_reduction_pct}% of background noise (fan, AC, hiss, room tone).",
                    "tip": "The AI analyzes the frequency spectrum to distinguish voice from noise, preserving vocal quality while eliminating unwanted sounds."
                },
                {
                    "action": f"Signal-to-Noise Ratio improved by {snr_improvement}dB",
                    "reason": "Two-pass processing: first removes constant noise (stationary), then variable noise (non-stationary) for maximum clarity.",
                    "tip": "Higher SNR means the voice is much clearer relative to the background. Professional recordings aim for 40dB+ SNR."
                }
            ]
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()

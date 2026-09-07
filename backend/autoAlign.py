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


def align_multi_track(reference_path, target_paths):
    """
    Align multiple target tracks to a single reference track.
    Returns per-track alignment data with sub-sample accuracy.
    """
    try:
        from scipy import signal
        
        # Load reference audio
        sr_ref, reference = wav.read(reference_path)
        if len(reference.shape) > 1:
            reference = reference.mean(axis=1)
        reference = reference.astype(np.float64)
        reference = reference / (np.max(np.abs(reference)) + 1e-8)
        
        results = []
        
        for target_path in target_paths:
            sr_t, target = wav.read(target_path)
            if len(target.shape) > 1:
                target = target.mean(axis=1)
            target = target.astype(np.float64)
            target = target / (np.max(np.abs(target)) + 1e-8)
            
            if sr_ref != sr_t:
                results.append({
                    "path": target_path,
                    "error": "Sample rate mismatch",
                    "delay_seconds": 0,
                    "confidence": 0
                })
                continue
            
            # Use first 30 seconds for global alignment
            max_samples = sr_ref * 30
            ref_segment = reference[:max_samples]
            target_segment = target[:min(max_samples, len(target))]
            
            # Global cross-correlation for coarse alignment
            correlation = signal.correlate(ref_segment, target_segment, mode='full', method='fft')
            center = len(target_segment) - 1
            lag = np.argmax(correlation) - center
            global_delay = lag / sr_ref
            global_confidence = float(np.max(correlation) / (np.sqrt(np.sum(ref_segment**2) * np.sum(target_segment**2)) + 1e-8))
            
            # Per-segment fine alignment (1-second windows, 0.5s hop)
            segment_duration = 1.0  # seconds
            segment_hop = 0.5  # seconds
            segment_samples = int(segment_duration * sr_ref)
            hop_samples = int(segment_hop * sr_ref)
            
            segments = []
            num_segments = max(1, int((min(len(reference), len(target)) - segment_samples) / hop_samples))
            
            for seg_idx in range(min(num_segments, 60)):  # Max 60 segments (30 seconds)
                seg_start = seg_idx * hop_samples
                seg_end = seg_start + segment_samples
                
                if seg_end > len(reference) or seg_end > len(target):
                    break
                
                ref_seg = reference[seg_start:seg_end]
                
                # Search window: ±100ms around expected position (adjusted by global delay)
                search_margin = int(0.1 * sr_ref)
                adjusted_start = seg_start + int(global_delay * sr_ref)
                t_start = max(0, adjusted_start - search_margin)
                t_end = min(len(target), adjusted_start + segment_samples + search_margin)
                
                if t_end - t_start < segment_samples:
                    continue
                    
                target_search = target[t_start:t_end]
                
                seg_corr = signal.correlate(target_search, ref_seg, mode='valid', method='fft')
                if len(seg_corr) == 0:
                    continue
                    
                seg_lag = np.argmax(seg_corr)
                local_offset = (t_start + seg_lag - seg_start) / sr_ref
                
                segments.append({
                    "time": float(seg_start / sr_ref),
                    "offset_seconds": float(local_offset),
                    "offset_ms": float(local_offset * 1000)
                })
            
            results.append({
                "path": target_path,
                "global_delay_seconds": float(global_delay),
                "global_delay_ms": float(global_delay * 1000),
                "confidence": float(min(1.0, max(0.0, global_confidence))),
                "segments": segments,
                "success": True
            })
        
        return {
            "success": True,
            "reference": reference_path,
            "alignments": results,
            "sample_rate": int(sr_ref)
        }
        
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)
    
    mode = sys.argv[1]
    
    if mode == "--multi":
        # Multi-track alignment mode
        # Usage: python autoAlign.py --multi <reference_path> <target1> <target2> ...
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Multi-track mode requires at least a reference and one target"}))
            sys.exit(1)
        ref_path = sys.argv[2]
        target_paths = sys.argv[3:]
        result = align_multi_track(ref_path, target_paths)
        print(json.dumps(result))
    else:
        # Legacy two-file alignment mode
        v_path = sys.argv[1]
        i_path = sys.argv[2]
        result = align_audio(v_path, i_path)
        print(json.dumps(result))

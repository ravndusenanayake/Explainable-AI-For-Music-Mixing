"""
bpmDetect.py
Detect BPM (tempo) of an audio file using librosa.
Usage: python bpmDetect.py <audio_file>
Output: JSON { "success": true, "bpm": 120.5, "beats": [0.5, 1.0, ...] }
"""
import sys
import json
import numpy as np

def detect_bpm(audio_path):
    try:
        import librosa
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        
        # Detect tempo and beat frames
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        
        # Convert tempo to float (it may be an ndarray)
        if hasattr(tempo, '__len__'):
            tempo = float(tempo[0])
        else:
            tempo = float(tempo)
        
        # Convert beat frames to timestamps
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        beat_times = [round(float(t), 3) for t in beat_times]
        
        # Detect key
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = int(np.argmax(np.mean(chroma, axis=1)))
        detected_key = key_names[key_idx]
        
        # Simple chord progression estimation
        chords = []
        if len(beat_frames) > 0:
            for i in range(len(beat_frames)-1):
                start = beat_frames[i]
                end = beat_frames[i+1]
                if start < end:
                    segment_chroma = np.mean(chroma[:, start:end], axis=1)
                    chord_idx = int(np.argmax(segment_chroma))
                    # simple heuristic: if the third above is strong, maybe major/minor, but we just output the root note as chord for simplicity
                    chords.append({"time": round(float(librosa.frames_to_time(start, sr=sr)), 2), "chord": key_names[chord_idx]})
                    
            # Filter to show only chord changes
            filtered_chords = []
            for c in chords:
                if not filtered_chords or filtered_chords[-1]["chord"] != c["chord"]:
                    filtered_chords.append(c)
        else:
            filtered_chords = []
        
        duration = float(len(y) / sr)
        
        return {
            "success": True,
            "bpm": round(tempo, 1),
            "beats": beat_times[:200],
            "key": detected_key,
            "chords": filtered_chords[:100], # Limit to first 100 changes
            "duration": round(duration, 2)
        }
    except ImportError:
        return {
            "success": False,
            "error": "librosa not installed. Run: pip install librosa"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No audio file provided"}))
        sys.exit(1)
    
    result = detect_bpm(sys.argv[1])
    print(json.dumps(result))

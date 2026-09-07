import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Music, Clock, Shield, Loader2, ChevronDown, Info, Play } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const NOTE_COLORS = {
  'C': '#ef4444', 'C#': '#f97316', 'D': '#eab308', 'D#': '#84cc16',
  'E': '#22c55e', 'F': '#14b8a6', 'F#': '#06b6d4', 'G': '#3b82f6',
  'G#': '#6366f1', 'A': '#8b5cf6', 'A#': '#a855f7', 'B': '#ec4899'
};

const PIANO_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const PitchEditor = ({ selectedTrackId }) => {
  const { tracks, mediaPool, handlePitchCorrection, isLoading, loadingStage } = useAudioContext();

  const [pitchData, setPitchData] = useState(null);
  const [detectedKey, setDetectedKey] = useState(null);
  const [snapStrength, setSnapStrength] = useState(50);
  const [timingStrength, setTimingStrength] = useState(0);
  const [formantPreserve, setFormantPreserve] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [explanations, setExplanations] = useState([]);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const track = tracks.find(t => t.id === selectedTrackId);
  const clip = track?.clips?.[0];
  const mediaId = clip?.mediaId;

  // Analyze pitch when a vocal track is selected
  const analyzePitch = useCallback(async () => {
    if (!mediaId) return;
    setIsAnalyzing(true);
    const result = await handlePitchCorrection(mediaId, { analyzeOnly: true });
    if (result?.analysis) {
      setPitchData(result.analysis.segments);
      setDetectedKey(result.analysis.detectedKey);
    }
    setIsAnalyzing(false);
  }, [mediaId, handlePitchCorrection]);

  // Draw piano-roll pitch visualization
  useEffect(() => {
    if (!pitchData || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    if (pitchData.length === 0) return;

    // Find MIDI note range
    const midiNotes = pitchData.filter(s => s.midiNote > 0).map(s => s.midiNote);
    if (midiNotes.length === 0) return;

    const minMidi = Math.min(...midiNotes) - 3;
    const maxMidi = Math.max(...midiNotes) + 3;
    const noteRange = maxMidi - minMidi;
    const maxTime = Math.max(...pitchData.map(s => s.endTime || s.startTime + s.duration));

    const pianoWidth = 50;
    const gridLeft = pianoWidth;
    const gridWidth = width - pianoWidth;
    const noteHeight = height / noteRange;

    // Draw piano keys on left side
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const noteIdx = ((midi % 12) + 12) % 12;
      const noteName = PIANO_KEYS[noteIdx];
      const isBlack = noteName.includes('#');
      const y = height - (midi - minMidi) * noteHeight;

      ctx.fillStyle = isBlack ? '#1a1a2e' : '#12121a';
      ctx.fillRect(0, y - noteHeight, pianoWidth, noteHeight);

      // Piano key label
      ctx.fillStyle = isBlack ? '#555' : '#333';
      ctx.fillRect(0, y - noteHeight, pianoWidth - 1, noteHeight - 0.5);
      ctx.fillStyle = isBlack ? '#888' : '#aaa';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${noteName}${Math.floor(midi / 12) - 1}`, pianoWidth - 4, y - noteHeight / 2 + 3);

      // Grid lines
      ctx.strokeStyle = isBlack ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(gridLeft, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw time grid (every 0.5 seconds)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let t = 0; t <= maxTime; t += 0.5) {
      const x = gridLeft + (t / maxTime) * gridWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (t % 1 === 0) {
        ctx.fillStyle = '#555';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${t.toFixed(0)}s`, x, 10);
      }
    }

    // Draw pitch segments as colored blocks
    pitchData.forEach(segment => {
      if (!segment.midiNote || segment.midiNote === 0) return;

      const x = gridLeft + (segment.startTime / maxTime) * gridWidth;
      const segWidth = Math.max(2, (segment.duration / maxTime) * gridWidth);
      const y = height - (segment.midiNote - minMidi) * noteHeight;

      // Color based on note name
      const noteIdx = ((segment.midiNote % 12) + 12) % 12;
      const noteName = PIANO_KEYS[noteIdx];
      const color = NOTE_COLORS[noteName] || '#3b82f6';

      // Main note block
      ctx.fillStyle = color + 'cc';
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight + 1, segWidth - 1, noteHeight - 2, 2);
      ctx.fill();

      // Cents deviation indicator (small line showing how far off-pitch)
      if (Math.abs(segment.avgCents) > 5) {
        const centsOffset = (segment.avgCents / 50) * (noteHeight / 2);
        ctx.strokeStyle = Math.abs(segment.avgCents) > 25 ? '#ef4444' : '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + segWidth / 2, y - noteHeight / 2);
        ctx.lineTo(x + segWidth / 2, y - noteHeight / 2 - centsOffset);
        ctx.stroke();
      }

      // Note label on wider segments
      if (segWidth > 25) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(segment.note, x + 3, y - noteHeight / 2 + 3);
        if (Math.abs(segment.avgCents) > 5) {
          ctx.fillStyle = Math.abs(segment.avgCents) > 25 ? '#fca5a5' : '#fde68a';
          ctx.font = '8px monospace';
          ctx.fillText(`${segment.avgCents > 0 ? '+' : ''}${segment.avgCents}¢`, x + 3, y - 3);
        }
      }
    });
  }, [pitchData]);

  const handleCorrect = async () => {
    if (!mediaId) return;
    const result = await handlePitchCorrection(mediaId, {
      snapStrength,
      timingStrength,
      formantPreserve,
      analyzeOnly: false
    });
    if (result?.explanations) {
      setExplanations(result.explanations);
    }
    if (result?.analysis) {
      setPitchData(result.analysis.segments);
      setDetectedKey(result.analysis.detectedKey);
    }
  };

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
        <Wand2 className="w-10 h-10 mb-3 opacity-30" />
        <h3 className="text-sm font-bold text-gray-400 mb-1">VariAudio — Pitch Editor</h3>
        <p className="text-xs">Select a vocal track to analyze and correct pitch</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#161616] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">VariAudio</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">{track.name}</span>
          {detectedKey && (
            <span className="px-2 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded text-[10px] text-violet-300 font-bold">
              <Music className="w-3 h-3 inline mr-1" />
              {detectedKey}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={analyzePitch}
            disabled={isLoading || isAnalyzing || !mediaId}
            className="flex items-center gap-1 px-3 py-1 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/30 text-violet-300 rounded text-[10px] font-bold transition-all disabled:opacity-30"
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Music className="w-3 h-3" />}
            Analyze Pitch
          </button>
          <button
            onClick={handleCorrect}
            disabled={isLoading || !pitchData}
            className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded text-[10px] font-bold transition-all disabled:opacity-30 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
          >
            {isLoading && !isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Correct Pitch
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center gap-6 px-4 py-2 border-b border-[#2a2a2a] bg-[#111] flex-shrink-0">
        {/* Pitch Snap Strength */}
        <div className="flex items-center gap-2">
          <Music className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-gray-400 font-mono w-16">Pitch Snap</span>
          <input
            type="range" min={0} max={100} step={1} value={snapStrength}
            onChange={(e) => setSnapStrength(parseInt(e.target.value))}
            className="w-24 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-violet-500"
          />
          <span className="text-[10px] text-violet-400 font-mono w-8">{snapStrength}%</span>
        </div>

        {/* Timing Correction */}
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] text-gray-400 font-mono w-12">Timing</span>
          <input
            type="range" min={0} max={100} step={1} value={timingStrength}
            onChange={(e) => setTimingStrength(parseInt(e.target.value))}
            className="w-24 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-[10px] text-cyan-400 font-mono w-8">{timingStrength}%</span>
        </div>

        {/* Formant Preserve */}
        <button
          onClick={() => setFormantPreserve(!formantPreserve)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
            formantPreserve
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-[#222] border border-[#444] text-gray-500'
          }`}
        >
          <Shield className="w-3 h-3" />
          Formant Preserve
        </button>
      </div>

      {/* Piano Roll Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0a0a0f]">
        {!pitchData && !isAnalyzing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <Wand2 className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-xs font-bold text-gray-400 mb-1">No Pitch Data</p>
            <p className="text-[10px]">Click "Analyze Pitch" to detect notes in the vocal track</p>
          </div>
        )}
        {isAnalyzing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mb-2" />
            <p className="text-xs text-violet-300 font-bold">Analyzing Pitch...</p>
          </div>
        )}
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      {/* Explanations */}
      {explanations.length > 0 && (
        <div className="flex-shrink-0 border-t border-[#2a2a2a] bg-[#111] p-2 max-h-24 overflow-y-auto">
          {explanations.map((exp, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              <Info className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-200 font-bold">{exp.action}</p>
                <p className="text-[9px] text-gray-500">{exp.tip}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PitchEditor;

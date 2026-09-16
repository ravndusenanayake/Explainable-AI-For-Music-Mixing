import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioContext } from '../context/AudioContext';
import { useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';
import {
  Play, Pause, Waves, ArrowRight, Plus, Upload, Music, Download,
  Volume2, Trash2, Scissors, Undo2, Redo2, Copy, Clipboard,
  ZoomIn, ZoomOut, Lock, Eye, EyeOff, Mic, Guitar, Drum,
  PlaySquare, Repeat, Settings2, SlidersHorizontal, Sparkles,
  ChevronUp, ChevronDown, Maximize2, Minimize2, X,
  Settings, Sliders, Wind, Zap, Disc, Circle, Wand2, Link2, Layers, Snowflake
} from 'lucide-react';
import MixConsole from '../components/MixConsole';
import MixExplainer from '../components/MixExplainer';
import AudioVisualizer from '../components/AudioVisualizer';
import DSPControls from '../components/DSPControls';
import VocalEQGuide from '../components/VocalEQGuide';
import TrackInspector from '../components/TrackInspector';
import PitchEditor from '../components/PitchEditor';
import AudioAligner from '../components/AudioAligner';
import ChannelStrip from '../components/ChannelStrip';
import ProjectsModal from '../components/ProjectsModal';
import { Cloud } from 'lucide-react';

// ==========================================
// HELPERS
// ==========================================
const formatTimecode = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const ms = Math.floor((sec % 1) * 100).toString().padStart(2, '0');
  return `${m}:${s}.${ms}`;
};

const formatTimeRuler = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `|${m}:${s}`;
};

// ==========================================
// COMPONENT: Clip
// ==========================================
const Clip = ({ clip, trackColor, onUpdateOffset, onRemove, zoomLevel, isSelected, onSelect, clipDurations, clipWsRefs, playheadTime, trackHeight, activeTool, onSplit, onToggleMute, onUpdateClipGain, showSpectrogram }) => {
  const containerRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [isDraggingGain, setIsDraggingGain] = useState(false);
  const [localGain, setLocalGain] = useState(clip.gain !== undefined ? clip.gain : 1);

  useEffect(() => {
    setLocalGain(clip.gain !== undefined ? clip.gain : 1);
  }, [clip.gain]);

  const handleGainPointerDown = (e) => {
    e.stopPropagation();
    setIsDraggingGain(true);
    
    const startY = e.clientY;
    const startGain = localGain;
    
    const onMove = (eMove) => {
      const deltaY = startY - eMove.clientY;
      let newGain = startGain + (deltaY / 100);
      newGain = Math.max(0, Math.min(3, newGain)); // cap at 0 to 3
      setLocalGain(newGain);
      if (onUpdateClipGain) onUpdateClipGain(clip.id, newGain);
    };
    
    const onUp = () => {
      setIsDraggingGain(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const gainDb = localGain === 0 ? '-inf' : (20 * Math.log10(localGain)).toFixed(1);

  useEffect(() => {
    if (!clip.file || !containerRef.current) return;
    const url = URL.createObjectURL(clip.file);
    const wsOptions = {
      container: containerRef.current,
      waveColor: 'rgba(255,255,255,0.4)',
      progressColor: 'rgba(255,255,255,0.9)',
      height: trackHeight - 20, // Leave room for clip header
      normalize: true,
      interact: false,
      barWidth: 2,
      barGap: 1,
      barRadius: 0,
      plugins: []
    };

    if (showSpectrogram) {
      wsOptions.plugins.push(
        Spectrogram.create({
          labels: true,
          height: trackHeight - 20,
          splitChannels: false,
        })
      );
    }

    const ws = WaveSurfer.create(wsOptions);
    ws.load(url);
    ws.on('ready', () => {
      const d = ws.getDuration();
      setDuration(d);
      if (clipDurations) clipDurations.current[clip.id] = d;
      if (clipWsRefs) clipWsRefs.current[clip.id] = ws;
    });
    return () => {
      if (clipWsRefs) delete clipWsRefs.current[clip.id];
      ws.destroy();
      URL.revokeObjectURL(url);
    };
  }, [clip.file, showSpectrogram]); // Removed trackHeight from here so we don't reload clip on zoom

  // Dynamic Height Update
  useEffect(() => {
    const ws = clipWsRefs?.current[clip.id];
    if (ws && ws.setOptions) {
      ws.setOptions({ height: trackHeight - 20 });
    }
  }, [trackHeight, clip.id, clipWsRefs]);

  const trimStart = clip.trimStartSec || 0;
  const trimEnd = clip.trimEndSec || duration;
  const clipDuration = trimEnd - trimStart;
  const width = clipDuration > 0 ? clipDuration * zoomLevel : 150;

  const bgColors = {
    rose: 'bg-[#9f1239] border-[#f43f5e]',
    pink: 'bg-[#831843] border-[#ec4899]',
    cyan: 'bg-[#164e63] border-[#06b6d4]',
    blue: 'bg-[#1e3a8a] border-[#3b82f6]',
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0 }}
      dragElastic={0}
      dragMomentum={false}
      onPointerDown={(e) => { 
        e.stopPropagation();
        if (activeTool === 'erase') {
          onRemove(clip.id);
        } else if (activeTool === 'mute') {
          if (onToggleMute) onToggleMute(clip.id);
        } else if (activeTool === 'split') {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const splitTime = clip.offset + (clickX / zoomLevel);
          if (onSplit) onSplit(clip.id, splitTime);
        } else {
          onSelect(clip.id); 
        }
      }}
      onDragEnd={(e, info) => {
        if (activeTool !== 'pointer') return;
        let newX = Math.max(0, clip.offset * zoomLevel + info.offset.x);

        // Magnetic Snapping: snap clip start to playhead if within 15 pixels
        if (playheadTime !== undefined) {
          const playheadX = playheadTime * zoomLevel;
          if (Math.abs(newX - playheadX) < 15) {
            newX = playheadX;
          }
        }

        onUpdateOffset(clip.id, newX / zoomLevel);
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, x: clip.offset * zoomLevel }}
      transition={{ type: 'spring', stiffness: 350, damping: 30, opacity: { duration: 0.15 } }}
      style={{ width }}
      className={`absolute top-[2px] bottom-[2px] rounded-sm cursor-grab active:cursor-grabbing border overflow-hidden group
        ${bgColors[trackColor] || bgColors.cyan}
        ${clip.isMuted ? 'opacity-40 grayscale' : (isSelected ? 'border-white ring-1 ring-white z-20' : 'opacity-90')}
      `}
    >
      {/* Clip Header with Name */}
      <div className="absolute top-0 left-0 right-0 h-[16px] bg-black/40 flex items-center justify-between px-1.5 z-10 border-b border-black/30">
        <span className="text-[9px] font-bold text-white/90 truncate leading-none drop-shadow-md">{clip.name}</span>
        
        {/* Gain Handle */}
        <div 
           onPointerDown={handleGainPointerDown}
           className="w-4 h-4 flex items-center justify-center cursor-ns-resize hover:bg-white/20 rounded-full mx-1 absolute left-1/2 -translate-x-1/2"
           title={`Clip Gain: ${gainDb}dB`}
        >
          <div className="w-2 h-0.5 bg-white/80" />
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onRemove(clip.id); }}
          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
        >
          <Trash2 className="w-2.5 h-2.5 drop-shadow-md" />
        </button>
      </div>
      {/* Waveform */}
      <div className="w-full h-full overflow-hidden relative">
        <div
          ref={containerRef}
          className="h-full pt-[16px] absolute top-0"
          style={{ left: -trimStart * zoomLevel, width: duration * zoomLevel }}
        />
      </div>
      {/* Trim handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/20 hover:bg-white/50 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity border-r border-black/20" />
      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-black/20 hover:bg-white/50 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity border-l border-black/20" />
      
      {/* Visual Gain Line overlay */}
      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${Math.max(16, trackHeight - (localGain / 3) * trackHeight)}px` }}>
         <div className="w-full border-t border-dashed border-white/50" />
      </div>

      {isDraggingGain && (
        <div className="absolute top-[18px] left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-1 py-0.5 rounded z-30">
          {gainDb} dB
        </div>
      )}
    </motion.div>
  );
};

// ==========================================
// COMPONENT: RecordingClip
// ==========================================
const RecordingClip = ({ startTime, playheadTime, zoomLevel, trackHeight, stream }) => {
  const width = Math.max(0, (playheadTime - startTime)) * zoomLevel;
  const canvasRef = useRef(null);
  const peaksRef = useRef([]);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    
    // Create AudioContext to analyze live mic
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    
    let drawVisual;
    let lastDrawTime = performance.now();
    
    const draw = (time) => {
      drawVisual = requestAnimationFrame(draw);
      
      // Calculate current amplitude
      analyser.getByteTimeDomainData(dataArray);
      let max = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = Math.abs((dataArray[i] / 128.0) - 1.0);
        if (val > max) max = val;
      }
      
      // Store a peak every 30ms for historical building waveform
      if (time - lastDrawTime > 30) {
        peaksRef.current.push(max);
        lastDrawTime = time;
      }
      
      // Dynamically update canvas internal resolution to match container width
      const displayWidth = canvas.clientWidth;
      if (canvas.width !== displayWidth) {
         canvas.width = Math.max(displayWidth, 1);
      }
      const cHeight = canvas.height;
      
      canvasCtx.clearRect(0, 0, canvas.width, cHeight);
      
      // Draw true waveform peaks
      canvasCtx.fillStyle = '#2a2b2d'; // Dark gray waveform matching Cubase
      canvasCtx.beginPath();
      
      const numPeaks = peaksRef.current.length;
      if (numPeaks === 0) return;
      
      const step = canvas.width / numPeaks;
      const centerY = cHeight / 2;
      
      // Draw top half
      canvasCtx.moveTo(0, centerY);
      for (let i = 0; i < numPeaks; i++) {
        const h = Math.max(2, peaksRef.current[i] * cHeight * 1.5); // Add minimum height and scale up slightly
        canvasCtx.lineTo(i * step, centerY - h/2);
      }
      
      // Draw bottom half backwards
      for (let i = numPeaks - 1; i >= 0; i--) {
        const h = Math.max(2, peaksRef.current[i] * cHeight * 1.5);
        canvasCtx.lineTo(i * step, centerY + h/2);
      }
      
      canvasCtx.closePath();
      canvasCtx.fill();
    };
    
    draw(performance.now());
    
    return () => {
      cancelAnimationFrame(drawVisual);
      audioCtx.close();
    };
  }, [stream]);

  return (
    <div
      style={{ left: startTime * zoomLevel, width: width, height: trackHeight - 4 }}
      className="absolute top-[2px] rounded-sm bg-[#959799] border border-[#666] overflow-hidden z-20"
    >
      <div className="absolute top-0 left-0 h-[16px] bg-[#d4d4d4] flex items-center px-1 border-b border-r border-[#666] z-10">
        <span className="text-[10px] font-bold text-black flex items-center gap-1 drop-shadow-sm">
          <Circle className="w-2 h-2 text-red-600 fill-red-600 animate-pulse" /> Recording
        </span>
      </div>
      <div className="w-full h-full relative overflow-hidden">
         <canvas ref={canvasRef} className="w-full h-full opacity-90" height={trackHeight - 4} />
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: Track
// ==========================================
const Track = ({ track, onDropMedia, onUpdateClipOffset, onRemoveClip, zoomLevel, selectedClipId, onSelectClip, onSetPlayhead, clipDurations, clipWsRefs, playheadTime, trackHeight, onMuteToggle, onSoloToggle, onVolumeChange, onSelectTrack, isSelectedTrack, activeTool, onSplitClip, onToggleClipMute, onUpdateClipGain, onToggleRecordEnable, onToggleMonitor, onToggleRead, onToggleWrite, isRecording, recordStartTime, targetRecordTrackId, activeStreamRef, showSpectrogram, onToggleFreeze }) => {
  const trackRef = useRef(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  const handleDrop = (e) => {
    e.preventDefault();
    if (isLocked) return;
    const mediaId = e.dataTransfer.getData('application/json');
    if (!mediaId) return;
    const rect = trackRef.current.getBoundingClientRect();
    const xPos = Math.max(0, e.clientX - rect.left);
    onDropMedia(track.id, mediaId, xPos / zoomLevel);
  };
  const handleTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const xPos = Math.max(0, e.clientX - rect.left);
    onSetPlayhead(xPos / zoomLevel);
    onSelectClip(null);
    if (onSelectTrack) onSelectTrack(track.id);
  };

  const trackIcons = {
    rose: <Mic className="w-3.5 h-3.5 text-rose-400" />,
    pink: <Mic className="w-3.5 h-3.5 text-pink-400" />,
    cyan: <Guitar className="w-3.5 h-3.5 text-cyan-400" />,
    blue: <Drum className="w-3.5 h-3.5 text-blue-400" />,
  };

  return (
    <div style={{ height: trackHeight }} className={`flex border-b border-black ${track.isMuted ? 'opacity-50 grayscale-[50%]' : ''}`}>
      {/* Cubase-style Track Header - 240px wide */}
      <div
        onClick={() => onSelectTrack(track.id)}
        className={`w-60 flex-shrink-0 border-r border-black flex flex-col justify-center px-1.5 py-1 z-30 sticky left-0 cursor-pointer transition-colors ${isSelectedTrack ? 'bg-[#333] border-l-4 border-l-cyan-500' : 'bg-[#252525] hover:bg-[#2a2a2a] border-l-4 border-l-transparent'}`}
      >

        {/* Top row: Name & Lock */}
        <div className="flex items-center justify-between mb-1 bg-[#1a1a1a] px-1.5 py-1 rounded-[2px] border border-[#111] shadow-inner">
          <div className="flex items-center gap-1.5 min-w-0">
            {trackIcons[track.color]}
            <span className="text-[10px] font-bold text-gray-200 truncate">{track.name}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onToggleFreeze(track.id)}
              className={`w-4 h-4 rounded-[2px] flex items-center justify-center transition-colors ${track.isFrozen ? 'bg-cyan-500/30 text-cyan-400' : 'text-[#666] hover:text-cyan-300'}`}
              title="Freeze Track (Pre-render)"
            >
              <Snowflake className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`w-4 h-4 rounded-[2px] flex items-center justify-center transition-colors ${isLocked ? 'bg-yellow-500/30 text-yellow-400' : 'text-[#666] hover:text-gray-300'}`}
              title="Lock Track"
            >
              <Lock className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Middle row: Mute & Solo & Volume */}
        <div className="flex items-center gap-1 mb-1">
          <button
            onClick={() => !track.isFrozen && onMuteToggle(track.id)}
            disabled={track.isFrozen}
            className={`w-6 h-5 rounded-[2px] flex items-center justify-center text-[10px] font-bold transition-colors border ${track.isMuted ? 'bg-[#eab308] border-[#ca8a04] text-black shadow-inner' : 'bg-[#1a1a1a] border-[#111] text-[#777] hover:bg-[#222]'} disabled:opacity-50`}
          >
            M
          </button>
          <button
            onClick={() => !track.isFrozen && onSoloToggle(track.id)}
            disabled={track.isFrozen}
            className={`w-6 h-5 rounded-[2px] flex items-center justify-center text-[10px] font-bold transition-colors border ${track.isSoloed ? 'bg-[#ef4444] border-[#dc2626] text-white shadow-inner' : 'bg-[#1a1a1a] border-[#111] text-[#777] hover:bg-[#222]'} disabled:opacity-50`}
          >
            S
          </button>

          <div className={`flex-1 flex items-center ml-1 p-0.5 rounded-[2px] border shadow-inner ${track.isFrozen ? 'bg-[#111] border-[#0a0a0a]' : 'bg-[#1a1a1a] border-[#111]'}`}>
            <input
              type="range" min="0" max="1" step="0.01"
              value={track.volume !== undefined ? track.volume : 1}
              onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
              disabled={track.isFrozen}
              className={`w-full h-2 rounded-[1px] appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-[1px] ${track.isFrozen ? 'bg-[#222] [&::-webkit-slider-thumb]:bg-[#444]' : 'bg-black [&::-webkit-slider-thumb]:bg-[#888] cursor-pointer hover:[&::-webkit-slider-thumb]:bg-cyan-400'}`}
            />
          </div>
        </div>
      </div>

      {/* Track Arrange Area */}
      <div
        ref={trackRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerDown={handleTrackClick}
        className={`flex-1 relative transition-colors overflow-hidden group border-r border-[#222] ${track.isFrozen ? 'bg-cyan-950/20' : 'bg-[#1c1c1c] hover:bg-[#1f1f1f]'}`}
      >
        {/* Subtle grid line visual */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(90deg,#ffffff_1px,transparent_1px)] bg-[length:20px_100%]" />

        {/* Frozen Overlay */}
        {track.isFrozen && (
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc4JyBoZWlnaHQ9JzgnPgo8cmVjdCB3aWR0aD0nOCcgaGVpZ2h0PSc4JyBmaWxsPScjZmZmJyBmaWxsLW9wYWNpdHk9JzAuMDInLz4KPHBhdGggZD0nTTAsMEw4LDhaTTEsN0w3LDFaJyBzdHJva2U9JyNmZmYnIHN0cm9rZS1vcGFjaXR5PScwLjAyJyBzdHJva2Utd2lkdGg9JzEnLz4KPC9zdmc+')] pointer-events-none z-10" />
        )}

        {track.clips.map(clip => (
          <Clip
            key={clip.id} clip={clip} trackColor={track.color}
            onUpdateOffset={(id, offset) => isLocked ? {} : onUpdateClipOffset(track.id, id, offset)}
            onRemove={(id) => isLocked ? {} : onRemoveClip(track.id, id)}
            zoomLevel={zoomLevel} isSelected={selectedClipId === clip.id} onSelect={onSelectClip}
            clipDurations={clipDurations} clipWsRefs={clipWsRefs} playheadTime={playheadTime}
            trackHeight={trackHeight} activeTool={activeTool} onSplit={onSplitClip} onToggleMute={onToggleClipMute}
            onUpdateClipGain={(id, gain) => isLocked ? {} : onUpdateClipGain(track.id, id, gain)}
            showSpectrogram={showSpectrogram}
          />
        ))}
        {track.clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none border-2 border-dashed border-white/20 m-2 rounded-md">
            <span className="text-[12px] font-bold uppercase tracking-widest text-white">
              {track.type === 'vocal' ? 'Drop Vocal Here' : 'Drop Beat / Instrumental Here'}
            </span>
          </div>
        )}
        
        {/* Render Live Recording Block if applicable */}
        {isRecording && targetRecordTrackId === track.id && recordStartTime !== null && (
          <RecordingClip startTime={recordStartTime} playheadTime={playheadTime} zoomLevel={zoomLevel} trackHeight={trackHeight} stream={activeStreamRef} />
        )}
        
        {/* Automation Lane overlay */}
        <AutomationLane data={track.automation} color={track.color} zoomLevel={zoomLevel} trackHeight={trackHeight} />
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: AutomationLane
// ==========================================
const AutomationLane = ({ data, color, zoomLevel, trackHeight }) => {
  if (!data || data.length === 0) return null;
  const mapY = (db) => {
    const clamped = Math.max(-20, Math.min(10, db));
    const ratio = (clamped + 20) / 30;
    return trackHeight - (ratio * trackHeight);
  };
  const points = data.map(d => `${d.time * zoomLevel},${mapY(d.gainDb)}`).join(' ');
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <svg className="w-full h-full overflow-visible">
        <polyline points={points} fill="none" stroke={color === 'rose' || color === 'pink' ? '#fda4af' : '#67e8f9'} strokeWidth="1.5" strokeOpacity="0.7" />
      </svg>
    </div>
  );
};

// ==========================================
// COMPONENT: TimelineRuler
// ==========================================
const TimelineRuler = ({ zoomLevel, playheadTime, onClickRuler, timelineWidth, isLooping, loopLeft, loopRight, onUpdateLoop }) => {
  const rulerRef = useRef(null);
  const interval = zoomLevel >= 80 ? 1 : zoomLevel >= 40 ? 2 : zoomLevel >= 20 ? 5 : 10;
  const maxSecs = timelineWidth / zoomLevel;
  const totalTicks = Math.max(10, Math.ceil(maxSecs / interval));

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();

    // Check if clicked on loop markers
    const clickX = e.clientX - rect.left;
    const isClickingLeft = isLooping && Math.abs(clickX - (loopLeft * zoomLevel)) < 10;
    const isClickingRight = isLooping && Math.abs(clickX - (loopRight * zoomLevel)) < 10;

    const updateTime = (clientX) => {
      const x = Math.max(0, clientX - rect.left);
      const time = Math.max(0, x / zoomLevel);
      if (isClickingLeft) {
        onUpdateLoop(Math.min(time, loopRight - 0.5), loopRight);
      } else if (isClickingRight) {
        onUpdateLoop(loopLeft, Math.max(time, loopLeft + 0.5));
      } else {
        onClickRuler(time);
      }
    };

    updateTime(e.clientX);

    const onPointerMove = (eMove) => updateTime(eMove.clientX);
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      ref={rulerRef}
      onPointerDown={handlePointerDown}
      className="h-7 bg-[#1a1a1a] border-b border-[#333] relative cursor-pointer select-none"
      style={{ width: timelineWidth }}
    >
      {/* Loop Region Highlight */}
      {isLooping && (
        <div
          className="absolute top-0 h-full bg-cyan-500/20 border-t-2 border-cyan-400 z-10"
          style={{ left: loopLeft * zoomLevel, width: (loopRight - loopLeft) * zoomLevel }}
        >
          {/* Left Locator Handle */}
          <div className="absolute top-0 bottom-0 left-[-4px] w-2 cursor-ew-resize hover:bg-cyan-300 transition-colors" />
          {/* Right Locator Handle */}
          <div className="absolute top-0 bottom-0 right-[-4px] w-2 cursor-ew-resize hover:bg-cyan-300 transition-colors" />
        </div>
      )}

      {/* Grid Ticks */}
      {[...Array(totalTicks)].map((_, i) => {
        const timeSec = i * interval;
        const x = timeSec * zoomLevel;
        const isMajor = timeSec % (interval * 5) === 0 || interval >= 5;
        return (
          <div key={i} className="absolute top-0 h-full" style={{ left: x }}>
            <div className={`w-px ${isMajor ? 'h-full bg-[#444]' : 'h-2 bg-[#333] mt-auto absolute bottom-0'}`} />
            {isMajor && (
              <span className="absolute top-1 left-1 text-[9px] font-mono text-[#777] whitespace-nowrap">
                {formatTimeRuler(timeSec)}
              </span>
            )}
          </div>
        );
      })}

      {/* Playhead Handle on Ruler */}
      <div
        className="absolute top-0 bottom-0 z-50 pointer-events-none"
        style={{ left: playheadTime * zoomLevel - 5.5 }}
      >
        <svg width="11" height="15" viewBox="0 0 11 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto drop-shadow-md">
          <path d="M1 1H10V8L5.5 14L1 8V1Z" fill="#141414" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <div className="w-px h-full bg-white mx-auto -mt-px" />
      </div>
    </div>
  );
};

// ==========================================
// MAIN EDITOR PAGE
// ==========================================
const EditorPage = () => {
  const {
    mediaPool, addMediaToPool, removeMediaFromPool, tracks, setTracks, updateTrackEffect,
    handleMix, isLoading, loadingStage, automationData,
    processedAudioUrl, sections, globalSummary, simpleExplanations,
    eqSettings, setEqSettings, handleStemSplit
  } = useAudioContext();

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const clipDurations = useRef({});
  const clipWsRefs = useRef({}); // Store references to wavesurfer instances for playback control

  // DAW View State
  const [zoomLevel, setZoomLevel] = useState(50);

  // Handle Ctrl + Scroll for horizontal zooming
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      // Allow Ctrl+Scroll or just normal horizontal scroll to adjust zoom if needed
      // Actually, many DAWs use Ctrl+Scroll for zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 10 : -10;
        setZoomLevel(prev => Math.min(200, Math.max(10, prev + delta)));
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);
  const [trackHeight, setTrackHeight] = useState(72); // Dynamic track height
  const [showMixer, setShowMixer] = useState(false);
  const [showSpectrogram, setShowSpectrogram] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);

  // Lower Zone State
  const [lowerZoneOpen, setLowerZoneOpen] = useState(false);
  const [lowerZoneTab, setLowerZoneTab] = useState('fx'); // 'fx' | 'xai' | 'dsp' | 'vocal' | 'mixer'
  const [lowerZoneHeight, setLowerZoneHeight] = useState(320);

  // Playback State
  const [playheadTime, setPlayheadTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopLeft, setLoopLeft] = useState(0);
  const [loopRight, setLoopRight] = useState(10); // default 10 seconds

  // Selection State
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // BPM / Tempo State
  const [detectedBpm, setDetectedBpm] = useState(null);
  const [detectedKey, setDetectedKey] = useState(null);
  const [detectedChords, setDetectedChords] = useState([]);
  const [isBpmLoading, setIsBpmLoading] = useState(false);

  // Reference Track State
  const [referenceAudioFile, setReferenceAudioFile] = useState(null);
  const [isReferenceActive, setIsReferenceActive] = useState(false);
  const referenceAudioRef = useRef(new Audio());

  useEffect(() => {
    if (referenceAudioFile) {
      const url = URL.createObjectURL(referenceAudioFile);
      referenceAudioRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [referenceAudioFile]);

  // A/B Muting Logic
  useEffect(() => {
    // Mute/Unmute wavesurfers based on A/B state
    Object.keys(clipWsRefs.current).forEach(id => {
      const ws = clipWsRefs.current[id];
      if (ws) {
        ws.setMuted(isReferenceActive);
      }
    });
    
    // Mute/Unmute reference track
    if (referenceAudioRef.current) {
      referenceAudioRef.current.muted = !isReferenceActive;
    }
  }, [isReferenceActive, clipWsRefs]);

  // Marker Track State
  const [markers, setMarkers] = useState([]);

  // ==========================================
  // WAV ENCODING UTILITY
  // ==========================================
  const encodeWAV = useCallback((samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF header
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, sampleRate, true);  // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Convert Float32 samples to Int16
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  // ==========================================
  // LIVE RECORDING STATE (Web Audio API PCM)
  // ==========================================
  const [isRecording, setIsRecording] = useState(false);
  const [recordStartTime, setRecordStartTime] = useState(null);
  const [targetRecordTrackId, setTargetRecordTrackId] = useState(null);
  const [measuredLatencyMs, setMeasuredLatencyMs] = useState(null);
  const activeStreamRef = useRef(null);
  const recordingStartOffsetRef = useRef(0);
  const recordingTargetTrackRef = useRef(null);
  const recordAudioCtxRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const pcmBuffersRef = useRef([]);
  const recordingSampleRateRef = useRef(44100);
  const recordingLatencyRef = useRef(0);

  const handleStop = () => {
    setIsPlaying(false);
    handleSeek(0);
    setRecordStartTime(null);
    isStartingRecordRef.current = false;
    if (isRecording) {
      // Stop the ScriptProcessor and disconnect nodes
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current = null;
      }

      // Finalize recording: merge PCM buffers and encode to WAV
      const allBuffers = pcmBuffersRef.current;
      if (allBuffers.length > 0) {
        const totalLength = allBuffers.reduce((sum, buf) => sum + buf.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const buf of allBuffers) {
          merged.set(buf, offset);
          offset += buf.length;
        }

        const sampleRate = recordingSampleRateRef.current;
        const wavBlob = encodeWAV(merged, sampleRate);
        const file = new File([wavBlob], `Live_Recording_${Date.now()}.wav`, { type: 'audio/wav' });
        const newMedia = addMediaToPool(file);

        const finalTrackId = recordingTargetTrackRef.current;
        if (finalTrackId) {
          pushUndo();
          // Apply latency compensation: shift the clip earlier by the measured input latency
          const latencyCompensation = recordingLatencyRef.current;
          const compensatedOffset = Math.max(0, recordingStartOffsetRef.current - latencyCompensation);
          console.log(`[Recording] Latency compensation: ${(latencyCompensation * 1000).toFixed(1)}ms | Raw offset: ${recordingStartOffsetRef.current.toFixed(3)}s → Compensated: ${compensatedOffset.toFixed(3)}s`);

          const newClip = {
            id: `clip_${Date.now()}`,
            mediaId: newMedia.id,
            file: file,
            offset: compensatedOffset,
            name: 'Live Take'
          };
          setTracks(prev => prev.map(t =>
            t.id === finalTrackId ? { ...t, clips: [...t.clips, newClip] } : t
          ));
        }
      }
      pcmBuffersRef.current = [];

      // Close the recording AudioContext
      if (recordAudioCtxRef.current && recordAudioCtxRef.current.state !== 'closed') {
        recordAudioCtxRef.current.close();
        recordAudioCtxRef.current = null;
      }

      // Stop mic stream tracks
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
        activeStreamRef.current = null;
      }

      setIsRecording(false);
      setRecordStartTime(null);
      setTargetRecordTrackId(null);
    }
  };

  const handleStopRef = useRef(handleStop);
  useEffect(() => { handleStopRef.current = handleStop; });

  const isRecordingRef = useRef(isRecording);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  const isStartingRecordRef = useRef(false);

  const handleRecordToggle = async () => {
    if (isRecording || isStartingRecordRef.current) {
      handleStop();
    } else {
      try {
        isStartingRecordRef.current = true;

        // Request mic with low-latency constraints, no browser processing
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
            latency: 0, // request lowest possible latency
          }
        });

        // Prevent race condition if user clicked stop before stream initialized
        if (!isStartingRecordRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        activeStreamRef.current = stream;

        // Create a dedicated AudioContext for recording (clean/dry signal path)
        const recCtx = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100,
          latencyHint: 'interactive'
        });
        recordAudioCtxRef.current = recCtx;
        recordingSampleRateRef.current = recCtx.sampleRate;

        // Measure the browser's input latency for compensation
        const baseLatency = recCtx.baseLatency || 0;
        const outputLatency = recCtx.outputLatency || 0;
        const totalLatency = baseLatency + outputLatency;
        recordingLatencyRef.current = totalLatency;
        setMeasuredLatencyMs(Math.round(totalLatency * 1000));
        console.log(`[Recording] AudioContext latency — base: ${(baseLatency * 1000).toFixed(1)}ms, output: ${(outputLatency * 1000).toFixed(1)}ms, total: ${(totalLatency * 1000).toFixed(1)}ms`);

        // Create source from mic stream (dry/clean, no effects)
        const source = recCtx.createMediaStreamSource(stream);

        // Add a GainNode to boost microphone input volume during recording
        const micGainNode = recCtx.createGain();
        micGainNode.gain.value = 2.5; // Boost volume by 2.5x

        // ScriptProcessorNode for PCM sample capture
        // Buffer size 4096 = ~93ms at 44100Hz — good balance of latency vs performance
        const processor = recCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        pcmBuffersRef.current = [];

        processor.onaudioprocess = (e) => {
          // Capture the raw input samples (channel 0, mono)
          const inputData = e.inputBuffer.getChannelData(0);
          // Copy the buffer since it gets reused
          pcmBuffersRef.current.push(new Float32Array(inputData));
        };

        // Connect: Mic → GainNode → ScriptProcessor → destination (needed to keep the processor alive)
        source.connect(micGainNode);
        micGainNode.connect(processor);
        processor.connect(recCtx.destination);

        // Save current playhead and target track
        recordingStartOffsetRef.current = playheadTime;
        const targetTrackId = selectedTrackId || tracks[0]?.id;
        recordingTargetTrackRef.current = targetTrackId;

        setIsRecording(true);
        setIsPlaying(true);
        setRecordStartTime(playheadTime);
        setTargetRecordTrackId(targetTrackId);
      } catch (err) {
        console.error("Microphone access denied or error:", err);
        alert(`Failed to start recording: ${err.name} - ${err.message}. Please check your microphone and permissions.`);
      } finally {
        isStartingRecordRef.current = false;
      }
    }
  };

  // Menu State
  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.daw-menu-container')) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleGlobalClick);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [activeMenu]);

  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  const loopLeftRef = useRef(loopLeft);
  useEffect(() => { loopLeftRef.current = loopLeft; }, [loopLeft]);
  const loopRightRef = useRef(loopRight);
  useEffect(() => { loopRightRef.current = loopRight; }, [loopRight]);

  const seekRequestRef = useRef(null);
  const handleSeek = (time) => {
    setPlayheadTime(time);
    if (referenceAudioRef.current.src) {
      referenceAudioRef.current.currentTime = time;
    }
    Object.values(clipWsRefs.current).forEach(ws => {
      if (ws) {
        try {
          const duration = ws.getDuration() || 0.1;
          ws.seekTo(Math.min(1, Math.max(0, time / duration)));
        } catch (err) {
          console.log('seek err', err);
        }
      }
    });
  };

  // Track Header Actions
  const handleMuteToggle = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t));
  };
  const handleSoloToggle = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isSoloed: !t.isSoloed } : t));
  };
  const handleVolumeChange = (trackId, newVol) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume: newVol } : t));
  };

  // Playback Engine (Solo, Mute, Volume, Looping)
  useEffect(() => {
    let animationFrame;
    let startTime;
    let startPlayhead;

    if (isPlaying) {
      startTime = performance.now();
      startPlayhead = playheadTime;

      const updatePlayhead = () => {
        let elapsed = (performance.now() - startTime) / 1000;
        let currentPlayhead = startPlayhead + elapsed;

        let didSeek = false;
        if (seekRequestRef.current !== null) {
          startPlayhead = seekRequestRef.current;
          startTime = performance.now();
          currentPlayhead = startPlayhead;
          seekRequestRef.current = null;
          didSeek = true;
        }

        // Loop handling
        if (isLoopingRef.current && currentPlayhead >= loopRightRef.current) {
          const loopDuration = loopRightRef.current - loopLeftRef.current;
          if (loopDuration > 0) {
            const loops = Math.floor((currentPlayhead - loopLeftRef.current) / loopDuration);
            currentPlayhead = currentPlayhead - (loops * loopDuration);
            startPlayhead = currentPlayhead;
            startTime = performance.now();
            didSeek = true;
          }
        }

        setPlayheadTime(currentPlayhead);

        // Determine if any track is soloed
        const anySolo = tracksRef.current.some(t => t.isSoloed);

        // Synchronize clip playback & volume
        tracksRef.current.forEach(t => {
          const shouldPlay = anySolo ? t.isSoloed : !t.isMuted;
          const trackVol = t.volume !== undefined ? t.volume : 1;

          t.clips.forEach(c => {
            const ws = clipWsRefs.current[c.id];
            if (ws) {
              // Apply volume (0.0 to 1.0) factoring in clip gain
              const clipGain = c.gain !== undefined ? c.gain : 1;
              const finalVol = Math.max(0, Math.min(1, trackVol * clipGain));
              if (ws.getVolume() !== finalVol) ws.setVolume(finalVol);

              const clipStart = c.offset;
              const clipDur = (c.trimEndSec || clipDurations.current[c.id] || ws.getDuration()) - (c.trimStartSec || 0);
              const clipEnd = clipStart + clipDur;

              if (shouldPlay && currentPlayhead >= clipStart && currentPlayhead < clipEnd) {
                if (!ws.isPlaying() || didSeek) {
                  const totalDur = ws.getDuration();
                  if (totalDur > 0) {
                    const relativeTime = (currentPlayhead - clipStart) + (c.trimStartSec || 0);
                    ws.seekTo(relativeTime / totalDur);
                    if (!ws.isPlaying()) ws.play();
                  }
                }
              } else {
                if (ws.isPlaying()) ws.pause();
              }
            }
          });
        });
        
        if (referenceAudioRef.current.src) {
          referenceAudioRef.current.currentTime = currentPlayhead;
          referenceAudioRef.current.play().catch(e => console.log(e));
        }

        animationFrame = requestAnimationFrame(updatePlayhead);
      };
      animationFrame = requestAnimationFrame(updatePlayhead);
    } else {
      // Pause all wavesurfers when playback stops
      tracksRef.current.forEach(t => {
        t.clips.forEach(c => {
          const ws = clipWsRefs.current[c.id];
          if (ws && ws.isPlaying()) ws.pause();
        });
      });
      if (referenceAudioRef.current.src) {
        referenceAudioRef.current.pause();
      }
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]); // Notice: Removed playheadTime, we recalculate internally

  // When playhead moves manually while paused, update wavesurfers so they preview the frame
  useEffect(() => {
    if (!isPlaying) {
      tracksRef.current.forEach(t => {
        t.clips.forEach(c => {
          const ws = clipWsRefs.current[c.id];
          if (ws) {
            const clipStart = c.offset;
            const clipDur = (c.trimEndSec || clipDurations.current[c.id] || ws.getDuration()) - (c.trimStartSec || 0);
            const clipEnd = clipStart + clipDur;

            if (playheadTime >= clipStart && playheadTime < clipEnd) {
              const totalDur = ws.getDuration();
              if (totalDur > 0) {
                const relativeTime = (playheadTime - clipStart) + (c.trimStartSec || 0);
                ws.seekTo(relativeTime / totalDur);
              }
            }
          }
        });
      });
      if (referenceAudioRef.current.src) {
        referenceAudioRef.current.currentTime = playheadTime;
      }
    }
  }, [playheadTime, isPlaying]);

  // Auto-scroll timeline to follow playhead (Cubase/FL Studio page scrolling style)
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const playheadPixel = 240 + playheadTime * zoomLevel;
      const visibleRightEdge = container.scrollLeft + container.clientWidth;
      const visibleLeftEdge = container.scrollLeft + 240;
      
      // If playhead leaves the visible track area, page scroll so it appears on the left
      if (playheadPixel > visibleRightEdge || playheadPixel < visibleLeftEdge) {
        container.scrollLeft = Math.max(0, playheadPixel - 240);
      }
    }
  }, [playheadTime, zoomLevel]);

  // Push undo snapshot
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), structuredClone(tracks)]);
    setRedoStack([]);
  }, [tracks]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev, structuredClone(tracks)]);
    setTracks(undoStack[undoStack.length - 1]);
    setUndoStack(prev => prev.slice(0, -1));
  }, [undoStack, tracks, setTracks]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev, structuredClone(tracks)]);
    setTracks(redoStack[redoStack.length - 1]);
    setRedoStack(prev => prev.slice(0, -1));
  }, [redoStack, tracks, setTracks]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => addMediaToPool(file));
  };

  const handleDragStartMedia = (e, mediaId) => {
    e.dataTransfer.setData('application/json', mediaId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropMedia = (trackId, mediaId, offset) => {
    const media = mediaPool.find(m => m.id === mediaId);
    if (!media) return;
    pushUndo();
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return { ...t, clips: [...t.clips, { id: `clip_${Date.now()}`, mediaId, file: media.file, name: media.name, offset }] };
      }
      return t;
    }));
  };

  const handleUpdateClipOffset = (clipId, newOffset) => {
    pushUndo();
    setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, offset: newOffset } : c) })));
  };

  const handleUpdateClipGain = useCallback((clipId, newGain) => {
    setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, gain: newGain } : c) })));
  }, [setTracks]);

  const handleRemoveClip = useCallback((clipId) => {
    setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) })));
  }, [setTracks]);

  const handleSplitClip = useCallback((clipId, splitTime) => {
    setTracks(prev => prev.map(t => {
      const clipIndex = t.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return t;
      const clip = t.clips[clipIndex];
      const origDuration = clipDurations.current[clip.id] || 999999;
      const clipTrimStart = clip.trimStartSec || 0;
      const clipTrimEnd = clip.trimEndSec || origDuration;
      const clipDur = clipTrimEnd - clipTrimStart;
      const clipStart = clip.offset;
      const clipEnd = clip.offset + clipDur;
      if (splitTime <= clipStart || splitTime >= clipEnd) return t;
      const splitInsideClip = splitTime - clipStart;
      const newTrimMidpoint = clipTrimStart + splitInsideClip;
      const leftClip = { ...clip, trimEndSec: newTrimMidpoint };
      const rightClip = { ...clip, id: `clip_${Date.now()}_right`, offset: splitTime, trimStartSec: newTrimMidpoint };
      const newClips = [...t.clips];
      newClips.splice(clipIndex, 1, leftClip, rightClip);
      return { ...t, clips: newClips };
    }));
  }, [setTracks]);

  const onMixClick = async () => {
    setIsPlaying(false);
    await handleMix();
    // Scroll to results automatically after mixing
    setTimeout(() => {
      document.getElementById('mix-results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ==========================================
  // EXPORT / BOUNCE
  // ==========================================
  const handleExportMix = useCallback((format = 'wav') => {
    if (!processedAudioUrl) {
      alert('No mix available. Generate an AI Mix first.');
      return;
    }
    try {
      // processedAudioUrl is a base64 data URI like "data:audio/wav;base64,..."
      const link = document.createElement('a');
      link.href = processedAudioUrl;
      const timestamp = new Date().toISOString().slice(0,10);
      link.download = `AI_Mix_${timestamp}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    }
  }, [processedAudioUrl]);

  // ==========================================
  // BPM DETECTION
  // ==========================================
  const handleDetectBpm = useCallback(async () => {
    // Find the first clip with a file
    let file = null;
    for (const t of tracks) {
      for (const c of t.clips) {
        if (c.file) { file = c.file; break; }
      }
      if (file) break;
    }
    if (!file) {
      // Try media pool
      if (mediaPool.length > 0) file = mediaPool[0].file;
    }
    if (!file) { alert('No audio files to analyze.'); return; }

    setIsBpmLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('http://localhost:5000/api/detect-bpm', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setDetectedBpm(data.bpm);
        setDetectedKey(data.key || null);
        if (data.chords) setDetectedChords(data.chords);

        // Auto-create markers from AI sections if available
        if (sections && sections.length > 0 && markers.length === 0) {
          const autoMarkers = sections.map((s, i) => ({
            id: `marker_${i}`,
            time: s.startTime,
            label: s.sectionType,
            color: s.sectionType === 'Chorus' ? '#a78bfa' : s.sectionType === 'Verse' ? '#4ade80' : '#60a5fa'
          }));
          setMarkers(autoMarkers);
        }
      } else {
        alert('BPM detection failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('BPM detection failed: ' + err.message);
    } finally {
      setIsBpmLoading(false);
    }
  }, [tracks, mediaPool, sections, markers]);

  const handleAddMarker = useCallback(() => {
    const label = prompt('Marker name:', `Marker ${markers.length + 1}`);
    if (!label) return;
    setMarkers(prev => [...prev, {
      id: `marker_${Date.now()}`,
      time: playheadTime,
      label,
      color: '#60a5fa'
    }]);
  }, [playheadTime, markers]);

  const handleRemoveMarker = useCallback((markerId) => {
    setMarkers(prev => prev.filter(m => m.id !== markerId));
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA') return;

      // Spacebar -> Play / Pause / Stop Recording
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        if (isRecordingRef.current) {
          handleStopRef.current();
        } else {
          setIsPlaying(prev => !prev);
        }
      }
      // Delete / Backspace -> Remove selected clip
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedClipId) {
        e.preventDefault();
        pushUndo();
        handleRemoveClip(selectedClipId);
        setSelectedClipId(null);
      }
      // Ctrl+B -> Split
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (selectedClipId) { pushUndo(); handleSplitClip(selectedClipId, playheadTime); }
      }
      // Ctrl+Z -> Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y -> Redo
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault(); handleRedo();
      }
      // Ctrl+C -> Copy selected clip
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedClipId) {
        e.preventDefault();
        for (const t of tracks) {
          const clip = t.clips.find(c => c.id === selectedClipId);
          if (clip) { setClipboard({ ...clip, trackId: t.id }); break; }
        }
      }
      // Ctrl+V -> Paste at playhead
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboard) {
        e.preventDefault();
        pushUndo();
        setTracks(prev => prev.map(t => {
          if (t.id === clipboard.trackId) {
            return { ...t, clips: [...t.clips, { ...clipboard, id: `clip_${Date.now()}_paste`, offset: playheadTime }] };
          }
          return t;
        }));
      }
      // + / = -> Zoom in
      if (e.key === '=' || e.key === '+') { setZoomLevel(prev => Math.min(200, prev + 10)); }
      // - -> Zoom out
      if (e.key === '-') { setZoomLevel(prev => Math.max(10, prev - 10)); }
      // Left/Right arrow -> nudge playhead
      if (e.key === 'ArrowLeft') { handleSeek(Math.max(0, playheadTime - (e.shiftKey ? 5 : 1))); }
      if (e.key === 'ArrowRight') { handleSeek(playheadTime + (e.shiftKey ? 5 : 1)); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, playheadTime, tracks, clipboard, pushUndo, handleUndo, handleRedo, handleSeek, handleRemoveClip, handleSplitClip, setTracks]);

  // Ctrl+Scroll Native Zoom (Must use native event to prevent browser page zoom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleNativeWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // Stop entire web page from zooming!
        setZoomLevel(prev => {
          const delta = e.deltaY > 0 ? -10 : 10;
          return Math.max(10, Math.min(1000, prev + delta));
        });
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, []);



  useEffect(() => {
    if (automationData) {
      setTracks(prev => prev.map(t => ({
        ...t, automation: t.type === 'vocal' ? automationData.vocal : automationData.instrumental
      })));
    }
  }, [automationData, setTracks]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center -mt-20">
        <div className="text-center">
          <div className="w-24 h-24 border-[4px] border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">AI is Mixing Your Project...</h3>
          <p className="text-gray-400">{loadingStage}</p>
        </div>
      </div>
    );
  }

  // Calculate the maximum width of the timeline based on clips + some padding
  const maxClipEndSec = tracks.reduce((max, track) => {
    return Math.max(max, ...track.clips.map(c => c.offset + ((clipDurations.current[c.id] || 0) - (c.trimStartSec || 0))));
  }, 0);
  const timelineWidth = Math.max(800, (maxClipEndSec + 60) * zoomLevel); // Add 60s padding to end

  const menuConfig = {
    'File': [
      { label: 'New Project', action: () => { if (window.confirm('Start new project?')) { setTracks([]); navigate('/'); } } },
      { label: 'Open Project...', action: () => alert('Open Project: Not implemented (Requires backend)') },
      { divider: true },
      { label: 'Save', action: () => alert('Save: Not implemented'), shortcut: 'Ctrl+S' },
      { label: 'Save As...', action: () => alert('Save As: Not implemented') },
      { divider: true },
      { label: 'Import Audio...', action: () => fileInputRef.current?.click(), shortcut: 'Ctrl+I' },
      { label: 'Export Mix...', action: () => handleExportMix('wav'), shortcut: 'Ctrl+E' },
    ],
    'Edit': [
      { label: 'Undo', action: handleUndo, shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: handleRedo, shortcut: 'Ctrl+Y' },
      { divider: true },
      { label: 'Cut', action: () => alert('Cut: Not implemented'), shortcut: 'Ctrl+X' },
      { label: 'Copy', action: () => alert('Copy: Not implemented'), shortcut: 'Ctrl+C' },
      { label: 'Paste', action: () => alert('Paste: Not implemented'), shortcut: 'Ctrl+V' },
      { divider: true },
      { label: 'Delete', action: () => { if (selectedClipId) { pushUndo(); handleRemoveClip(selectedClipId); setSelectedClipId(null); } }, shortcut: 'Del' },
      { label: 'Split at Playhead', action: () => { if (selectedClipId) { pushUndo(); handleSplitClip(selectedClipId, playheadTime); } }, shortcut: 'Ctrl+B' },
    ],
    'Window': [
      { label: 'Toggle Lower Zone', action: () => setLowerZoneOpen(!lowerZoneOpen) },
      { label: 'MixConsole', action: () => { setLowerZoneOpen(true); setLowerZoneTab('mixer'); }, shortcut: 'F3' },
      { label: 'FX Rack', action: () => { setLowerZoneOpen(true); setLowerZoneTab('fx'); } },
      { label: 'AI Explainer', action: () => { setLowerZoneOpen(true); setLowerZoneTab('xai'); } },
      { divider: true },
      { label: 'Zoom In', action: () => setZoomLevel(prev => Math.min(200, prev + 10)), shortcut: 'Ctrl++' },
      { label: 'Zoom Out', action: () => setZoomLevel(prev => Math.max(10, prev - 10)), shortcut: 'Ctrl+-' },
    ]
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#111] text-gray-300 font-sans select-none">

      {/* DESKTOP MENU BAR */}
      <div className="h-7 w-full bg-[#202020] border-b border-black flex items-center px-4 z-50 shrink-0">
        <div className="flex items-center gap-1 text-[11px]">
          <div className="flex items-center gap-1.5 mr-4" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <Music className="w-3 h-3 text-cyan-400" />
            <span className="font-bold text-gray-200 tracking-wide">MIX STUDIO</span>
          </div>
          {['File', 'Edit', 'Project', 'Audio', 'MIDI', 'Media', 'Transport', 'Studio', 'Window', 'Help'].map(item => (
            <div key={item} className="relative daw-menu-container">
              <span
                onMouseDown={() => setActiveMenu(activeMenu === item ? null : item)}
                onMouseEnter={() => { if (activeMenu && activeMenu !== item) setActiveMenu(item); }}
                className={`px-2 py-0.5 rounded-[2px] cursor-pointer transition-colors ${activeMenu === item ? 'bg-white/20 text-white' : 'text-[#a0a0a0] hover:bg-white/10 hover:text-white'}`}
              >
                {item}
              </span>

              {/* Dropdown Menu */}
              {activeMenu === item && menuConfig[item] && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[#1a1a1a] border border-black shadow-xl py-1 z-50 rounded-sm">
                  {menuConfig[item].map((menuItem, idx) =>
                    menuItem.divider ? (
                      <div key={idx} className="h-px w-full bg-black my-1" />
                    ) : (
                      <div
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          menuItem.action();
                          setActiveMenu(null);
                        }}
                        className="px-4 py-1.5 flex items-center justify-between hover:bg-cyan-600 cursor-pointer group text-gray-200 hover:text-white"
                      >
                        <span>{menuItem.label}</span>
                        {menuItem.shortcut && (
                          <span className="text-gray-500 group-hover:text-cyan-200 text-[9px]">{menuItem.shortcut}</span>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex min-w-[1024px] overflow-hidden">

        {/* LEFT SIDEBAR: Media Pool */}
        <div className="w-60 flex-shrink-0 bg-[#1e1e1e] border-r border-black flex flex-col z-40 relative shadow-lg">
          <div className="p-2 border-b border-black bg-gradient-to-b from-[#2d2d2d] to-[#252525] flex items-center justify-between">
            <h2 className="font-bold text-[10px] text-gray-300 tracking-widest uppercase ml-1">Media Pool</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-5 h-5 rounded-[2px] bg-cyan-600/30 hover:bg-cyan-500/50 flex items-center justify-center text-cyan-400 transition-colors border border-cyan-700/50"
              title="Import Media"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="audio/*" className="hidden" />
          </div>

          <div className="flex-1 overflow-y-auto p-1.5">
            {mediaPool.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-40">
                <Upload className="w-6 h-6 mb-2 text-gray-500" />
                <p className="text-[10px] text-gray-500">Import audio stems</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <AnimatePresence>
                  {mediaPool.map(media => (
                    <motion.div
                      key={media.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      draggable
                      onDragStart={(e) => handleDragStartMedia(e, media.id)}
                      className="p-1.5 bg-[#252525] hover:bg-[#2a2a2a] rounded-[2px] cursor-grab active:cursor-grabbing border border-[#111] flex items-center gap-2 transition-colors mb-0.5 shadow-sm group"
                    >
                      <div className={`w-1 h-5 rounded-full ${media.type === 'vocal' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-200 truncate leading-tight">{media.name}</p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase leading-tight">{media.type}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStemSplit(media.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-cyan-400 transition-all hover:bg-black/20 rounded-[2px]"
                        title="Split into Stems (AI)"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMediaFromPool(media.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all hover:bg-black/20 rounded-[2px]"
                        title="Remove from Pool"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* MAIN ARRANGE WINDOW */}
        <div className="flex-1 flex flex-col min-w-[500px] bg-[#141414] relative z-30">

          {/* Top Toolbar - Professional DAW style */}
          <div className="h-10 bg-gradient-to-b from-[#252525] to-[#1e1e1e] border-b border-black flex items-center justify-between px-2 z-50 relative shadow-sm flex-shrink-0">
            {/* Left: Tools */}
            <div className="flex items-center gap-0.5">
              <button onClick={handleUndo} className={`w-8 h-8 rounded-[3px] flex items-center justify-center transition-colors ${undoStack.length > 0 ? 'text-[#c0c0c0] hover:bg-black/30' : 'text-[#555]'}`} title="Undo (Ctrl+Z)">
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={handleRedo} className={`w-8 h-8 rounded-[3px] flex items-center justify-center transition-colors ${redoStack.length > 0 ? 'text-[#c0c0c0] hover:bg-black/30' : 'text-[#555]'}`} title="Redo (Ctrl+Y)">
                <Redo2 className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-black mx-2" />
              <button
                onClick={() => { if (selectedClipId) { pushUndo(); handleSplitClip(selectedClipId, playheadTime); } }}
                className={`w-8 h-8 rounded-[3px] flex items-center justify-center transition-colors ${selectedClipId ? 'text-[#c0c0c0] hover:bg-black/30' : 'text-[#555]'}`}
                title="Split (Ctrl+B)"
              >
                <Scissors className="w-4 h-4" />
              </button>
              <button
                onClick={() => { if (selectedClipId) { pushUndo(); handleRemoveClip(selectedClipId); setSelectedClipId(null); } }}
                className={`w-8 h-8 rounded-[3px] flex items-center justify-center transition-colors ${selectedClipId ? 'text-[#c0c0c0] hover:bg-black/30' : 'text-[#555]'}`}
                title="Delete (Backspace)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-black mx-2" />
              <button
                onClick={() => { setLowerZoneOpen(true); setLowerZoneTab('mixer'); }}
                className={`w-8 h-8 rounded-[3px] flex items-center justify-center transition-colors border ${(lowerZoneOpen && lowerZoneTab === 'mixer') ? 'bg-cyan-900/40 text-cyan-400 border-cyan-800' : 'text-[#c0c0c0] hover:bg-black/30 border-transparent'}`}
                title="Toggle MixConsole (F3)"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Center: Transport & Ref Track */}
            <div className="flex items-center gap-4">
              
              {/* Reference Track A/B */}
              <div className="flex items-center gap-1">
                <input
                  type="file" accept="audio/*" className="hidden" id="ref-track-upload"
                  onChange={(e) => { if(e.target.files[0]) { setReferenceAudioFile(e.target.files[0]); setIsReferenceActive(true); } }}
                />
                {!referenceAudioFile ? (
                  <button
                    onClick={() => document.getElementById('ref-track-upload').click()}
                    className="px-2 py-1 bg-black/30 border border-[#333] text-[9px] font-bold text-gray-400 rounded-[2px] hover:text-white"
                    title="Load Reference Track for A/B Compare"
                  >
                    REF LOAD
                  </button>
                ) : (
                  <div className="flex bg-black/50 border border-[#333] rounded-[2px] overflow-hidden">
                    <button
                      onClick={() => setIsReferenceActive(false)}
                      className={`px-3 py-1 text-[10px] font-bold transition-colors ${!isReferenceActive ? 'bg-cyan-600 text-white shadow-inner' : 'text-gray-500 hover:bg-white/10'}`}
                    >
                      A (MIX)
                    </button>
                    <button
                      onClick={() => setIsReferenceActive(true)}
                      className={`px-3 py-1 text-[10px] font-bold transition-colors ${isReferenceActive ? 'bg-orange-600 text-white shadow-inner' : 'text-gray-500 hover:bg-white/10'}`}
                    >
                      B (REF)
                    </button>
                    <button
                      onClick={() => { setReferenceAudioFile(null); setIsReferenceActive(false); referenceAudioRef.current.src = ""; }}
                      className="px-2 py-1 text-gray-500 hover:text-red-400 hover:bg-white/10 transition-colors"
                      title="Clear Reference Track"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Main Transport */}
              <div className="flex items-center bg-[#111] border border-black rounded-[4px] p-0.5 shadow-inner">
              <button
                onClick={() => handleSeek(0)}
                className="w-8 h-7 flex items-center justify-center text-[#999] hover:text-white hover:bg-[#222] rounded-[2px]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
              </button>
              
              <button
                onClick={handleRecordToggle}
                className={`w-9 h-7 flex items-center justify-center hover:bg-[#222] rounded-[2px] transition-colors ${isRecording ? 'animate-pulse bg-red-900/40' : ''}`}
                title={isRecording && measuredLatencyMs !== null ? `Recording — Latency: ${measuredLatencyMs}ms (compensated)` : 'Record (Live)'}
              >
                <Circle className={`w-3.5 h-3.5 ${isRecording ? 'text-red-500 fill-red-500' : 'text-[#c0c0c0]'}`} />
              </button>
              {isRecording && measuredLatencyMs !== null && (
                <span className="text-[9px] text-yellow-400 font-mono ml-0.5 whitespace-nowrap" title="Input latency (auto-compensated)">
                  {measuredLatencyMs}ms
                </span>
              )}

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-7 flex items-center justify-center hover:bg-[#222] rounded-[2px] transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-cyan-400 fill-current" /> : <Play className="w-4 h-4 text-[#c0c0c0] fill-current" />}
              </button>
              <button
                onClick={handleStop}
                className="w-8 h-7 flex items-center justify-center text-[#999] hover:text-white hover:bg-[#222] rounded-[2px]"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
              </button>
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`w-8 h-7 flex items-center justify-center rounded-[2px] transition-colors ${isLooping ? 'bg-cyan-600/40 text-cyan-400' : 'text-[#999] hover:text-white hover:bg-[#222]'}`}
              >
                <Repeat className="w-4 h-4" />
              </button>

              {/* Timecode LED Display */}
              <div className="ml-2 bg-black border border-[#222] px-3 h-7 flex items-center justify-center rounded-[2px] min-w-[80px]">
                <span className="font-mono text-cyan-400 text-xs tracking-wider font-bold">
                  {formatTimecode(playheadTime)}
                </span>
              </div>
            </div>
            </div>

            {/* Right: Zoom + Mix */}
            <div className="flex items-center gap-2">

              {/* Spectrogram Toggle */}
              <button
                onClick={() => setShowSpectrogram(!showSpectrogram)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-[10px] font-bold transition-all border ${showSpectrogram ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/30 border-[#2a2a2a] text-gray-400 hover:text-white'}`}
                title="Toggle Spectrogram View"
              >
                <Layers className="w-3 h-3" />
                {showSpectrogram ? 'SPEC: ON' : 'SPEC: OFF'}
              </button>

              {/* Vertical Track Height Slider */}
              <div className="flex items-center gap-1.5 bg-black/30 rounded px-2 py-1 border border-[#2a2a2a]">
                <Settings2 className="w-3 h-3 text-gray-500" />
                <input
                  type="range" min="40" max="150" value={trackHeight} onChange={(e) => setTrackHeight(parseInt(e.target.value))}
                  className="w-16 h-1 bg-[#444] rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                  title="Track Height"
                />
              </div>

              {/* BPM Display */}
              <div className="flex items-center gap-1 bg-black/30 rounded px-2 py-1 border border-[#2a2a2a]">
                <button
                  onClick={handleDetectBpm}
                  disabled={isBpmLoading}
                  className="text-[10px] font-bold text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                  title="Auto-detect BPM"
                >
                  {isBpmLoading ? '...' : '♩'}
                </button>
                <span className="text-[10px] font-mono text-cyan-400 min-w-[40px] text-center">
                  {detectedBpm ? `${detectedBpm}` : '---'} BPM
                </span>
                {detectedKey && (
                  <span className="text-[9px] font-bold text-violet-400 px-1 border-l border-white/10">
                    {detectedKey}
                  </span>
                )}
              </div>

              {/* Add Marker */}
              <button
                onClick={handleAddMarker}
                className="w-7 h-7 rounded-[3px] flex items-center justify-center text-[#999] hover:text-yellow-400 hover:bg-black/30 transition-colors border border-transparent hover:border-yellow-800/50"
                title="Add Marker at Playhead (M)"
              >
                <span className="text-[11px] font-bold">⚑</span>
              </button>

              <div className="flex items-center gap-1 bg-black/30 rounded px-1 border border-[#2a2a2a]">
                <button onClick={() => setZoomLevel(prev => Math.max(10, prev - 10))} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white">
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-[9px] font-mono text-gray-400 w-8 text-center">{zoomLevel}%</span>
                <button onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white">
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={async () => {
                  setIsPlaying(false);
                  await handleMix();
                  setLowerZoneOpen(true);
                  setLowerZoneTab('xai');
                }}
                className="ml-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-1.5 rounded-[3px] shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2 border border-cyan-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                GENERATE AI MIX
              </button>

              <button
                onClick={() => setIsProjectsModalOpen(true)}
                className="ml-2 bg-[#1a1a1a] hover:bg-[#222] text-gray-300 text-xs font-bold px-3 py-1.5 rounded-[3px] transition-all flex items-center gap-2 border border-[#333] hover:border-cyan-500/50"
              >
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                Cloud Projects
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-row bg-[#141414] relative">

            <div className="flex-1 overflow-hidden flex flex-col relative min-w-0">
              {/* Timeline Section - Takes remaining space */}
              <div className="flex-1 relative overflow-hidden">
                <div
                  className="absolute inset-0 overflow-auto"
                  ref={scrollContainerRef}
                >
                  <div style={{ width: timelineWidth, minHeight: '100%' }} className="relative flex flex-col bg-[#141414]">

                    {/* Ruler Row (Sticky Top) */}
                    <div className="flex sticky top-0 z-40 bg-[#1a1a1a]">
                      {/* Spacer above track headers (Sticky Left) */}
                      <div className="w-60 flex-shrink-0 border-r border-black border-b border-b-[#333] sticky left-0 z-50 bg-[#1e1e1e]" />
                      <div className="flex-1 relative">
                        <TimelineRuler
                          zoomLevel={zoomLevel} playheadTime={playheadTime} onClickRuler={handleSeek} timelineWidth={timelineWidth}
                          isLooping={isLooping} loopLeft={loopLeft} loopRight={loopRight}
                          onUpdateLoop={(l, r) => { setLoopLeft(l); setLoopRight(r); }}
                        />
                        {/* Marker Track overlay */}
                        {markers.length > 0 && (
                          <div className="absolute left-0 right-0 bottom-0 h-4 pointer-events-none z-10">
                            {markers.map(marker => (
                              <div
                                key={marker.id}
                                className="absolute bottom-0 flex items-end pointer-events-auto cursor-pointer group"
                                style={{ left: marker.time * zoomLevel }}
                                onClick={() => handleSeek(marker.time)}
                                onContextMenu={(e) => { e.preventDefault(); handleRemoveMarker(marker.id); }}
                                title={`${marker.label} — Right-click to remove`}
                              >
                                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-transparent" style={{ borderBottomColor: marker.color }} />
                                <span className="text-[8px] font-bold ml-0.5 whitespace-nowrap opacity-70 group-hover:opacity-100" style={{ color: marker.color }}>
                                  {marker.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Chord Track overlay */}
                        {detectedChords.length > 0 && (
                          <div className="absolute left-0 right-0 bottom-4 h-3 pointer-events-none z-10 opacity-60">
                            {detectedChords.map((chordObj, idx) => (
                              <div
                                key={`chord_${idx}`}
                                className="absolute bottom-0 text-[8px] font-bold text-violet-400 bg-black/50 px-1 rounded-sm border border-violet-900/50"
                                style={{ left: chordObj.time * zoomLevel }}
                              >
                                {chordObj.chord}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tracks */}
                    {tracks.map(track => (
                      <Track
                        key={track.id} track={track} onDropMedia={handleDropMedia}
                        onUpdateClipOffset={handleUpdateClipOffset} onRemoveClip={handleRemoveClip}
                        zoomLevel={zoomLevel} selectedClipId={selectedClipId} onSelectClip={setSelectedClipId}
                        onSetPlayhead={handleSeek} clipDurations={clipDurations} clipWsRefs={clipWsRefs}
                        playheadTime={playheadTime} trackHeight={trackHeight}
                        onMuteToggle={handleMuteToggle} onSoloToggle={handleSoloToggle} onVolumeChange={handleVolumeChange}
                        onSelectTrack={setSelectedTrackId} isSelectedTrack={selectedTrackId === track.id}
                        isRecording={isRecording} recordStartTime={recordStartTime} targetRecordTrackId={targetRecordTrackId} activeStreamRef={activeStreamRef.current}
                        onUpdateClipGain={handleUpdateClipGain} showSpectrogram={showSpectrogram}
                        onToggleFreeze={(trackId) => setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isFrozen: !t.isFrozen } : t))}
                      />
                    ))}

                    {/* Global Playhead Line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-white z-30 pointer-events-none"
                      style={{ left: 240 + playheadTime * zoomLevel }}
                    />
                  </div>
                </div>
              </div>

              {/* ============================================ */}
              {/* LOWER ZONE - Cubase-style tabbed bottom panel */}
              {/* ============================================ */}
              {lowerZoneOpen && (
                <div
                  className="flex-shrink-0 border-t-2 border-black bg-[#111] flex flex-col z-40 relative shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
                  style={{ height: lowerZoneHeight }}
                >
                  {/* Tab Bar */}
                  <div className="h-8 bg-gradient-to-b from-[#2d2d2d] to-[#222] border-b border-black flex items-center justify-between px-1 flex-shrink-0">
                    <div className="flex items-center gap-0">
                      {[
                        { id: 'fx', label: 'FX Rack', icon: <Settings className="w-3 h-3" /> },
                        { id: 'mixer', label: 'MixConsole', icon: <SlidersHorizontal className="w-3 h-3" /> },
                        { id: 'xai', label: 'AI Explainer', icon: <Sparkles className="w-3 h-3" /> },
                        { id: 'channelstrip', label: 'Channel Strip', icon: <Layers className="w-3 h-3" /> },
                        { id: 'variaudio', label: 'VariAudio', icon: <Wand2 className="w-3 h-3" /> },
                        { id: 'align', label: 'Audio Align', icon: <Link2 className="w-3 h-3" /> },
                        { id: 'dsp', label: 'DSP Controls', icon: <Sliders className="w-3 h-3" /> },
                        { id: 'vocal', label: 'Vocal Chain', icon: <Mic className="w-3 h-3" /> },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setLowerZoneTab(tab.id)}
                          className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${lowerZoneTab === tab.id
                              ? 'text-cyan-400 border-b-cyan-500 bg-black/20'
                              : 'text-[#888] border-b-transparent hover:text-white hover:bg-white/5'
                            }`}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLowerZoneHeight(prev => prev === 320 ? 500 : 320)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      >
                        {lowerZoneHeight > 320 ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setLowerZoneOpen(false)}
                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-auto">

                    {/* FX RACK TAB */}
                    {lowerZoneTab === 'fx' && (() => {
                      const track = tracks.find(t => t.id === selectedTrackId);
                      if (!track || !track.effects) {
                        return (
                          <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                            <div className="text-center">
                              <Settings className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p>Select a track to view its effect rack</p>
                            </div>
                          </div>
                        );
                      }
                      const { effects } = track;
                      const update = (effectKey, updates) => updateTrackEffect(track.id, effectKey, updates);
                      return (
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Settings className="w-4 h-4 text-cyan-400" />
                            <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">{track.name} — Insert Effects</span>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">

                            {/* EQ */}
                            <div className="bg-[#1a1a1a] border border-black rounded-sm p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1"><Sliders className="w-3 h-3 text-rose-400" /> EQ</span>
                                <button onClick={() => { pushUndo(); update('eq', { enabled: !effects.eq?.enabled }); }} className={`w-7 h-4 rounded-full relative transition-colors ${effects.eq?.enabled ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${effects.eq?.enabled ? 'left-3.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              <div className="text-[9px] text-gray-500 mt-1">Parametric equalizer for tone shaping</div>
                            </div>

                            {/* De-Esser */}
                            <div className="bg-[#1a1a1a] border border-black rounded-sm p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1"><Wind className="w-3 h-3 text-cyan-400" /> De-Esser</span>
                                <button onClick={() => { pushUndo(); update('deEsser', { enabled: !effects.deEsser.enabled }); }} className={`w-7 h-4 rounded-full relative transition-colors ${effects.deEsser.enabled ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${effects.deEsser.enabled ? 'left-3.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              {effects.deEsser.enabled && (
                                <div>
                                  <div className="flex justify-between text-[9px] text-gray-400 font-mono"><span>Amount</span><span>{effects.deEsser.amount}%</span></div>
                                  <input type="range" min={0} max={100} step={1} value={effects.deEsser.amount} onChange={(e) => { pushUndo(); update('deEsser', { amount: parseFloat(e.target.value) }); }} className="w-full h-1 bg-black rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#888] [&::-webkit-slider-thumb]:rounded-[1px] cursor-pointer" />
                                </div>
                              )}
                            </div>

                            {/* Compressor */}
                            <div className="bg-[#1a1a1a] border border-black rounded-sm p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> Compressor</span>
                                <button onClick={() => { pushUndo(); update('compressor', { enabled: !effects.compressor.enabled }); }} className={`w-7 h-4 rounded-full relative transition-colors ${effects.compressor.enabled ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${effects.compressor.enabled ? 'left-3.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              {effects.compressor.enabled && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[9px] text-gray-400 font-mono"><span>Threshold</span><span>{effects.compressor.threshold}dB</span></div>
                                  <input type="range" min={-40} max={0} step={0.5} value={effects.compressor.threshold} onChange={(e) => { pushUndo(); update('compressor', { threshold: parseFloat(e.target.value) }); }} className="w-full h-1 bg-black rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#888] [&::-webkit-slider-thumb]:rounded-[1px] cursor-pointer" />
                                  <div className="flex justify-between text-[9px] text-gray-400 font-mono"><span>Ratio</span><span>{effects.compressor.ratio}:1</span></div>
                                  <input type="range" min={1} max={10} step={0.1} value={effects.compressor.ratio} onChange={(e) => { pushUndo(); update('compressor', { ratio: parseFloat(e.target.value) }); }} className="w-full h-1 bg-black rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#888] [&::-webkit-slider-thumb]:rounded-[1px] cursor-pointer" />
                                </div>
                              )}
                            </div>

                            {/* Reverb */}
                            <div className="bg-[#1a1a1a] border border-black rounded-sm p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1"><Waves className="w-3 h-3 text-blue-400" /> Reverb</span>
                                <button onClick={() => { pushUndo(); update('reverb', { enabled: !effects.reverb.enabled }); }} className={`w-7 h-4 rounded-full relative transition-colors ${effects.reverb.enabled ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${effects.reverb.enabled ? 'left-3.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              {effects.reverb.enabled && (
                                <div className="space-y-1">
                                  <select value={effects.reverb.type} onChange={(e) => { pushUndo(); update('reverb', { type: e.target.value }); }} className="w-full bg-black border border-[#333] rounded-[2px] text-[10px] text-gray-200 p-1 outline-none focus:border-cyan-500">
                                    <option value="room">Room</option>
                                    <option value="plate">Plate</option>
                                    <option value="hall">Hall</option>
                                    <option value="valhalla">Valhalla</option>
                                  </select>
                                  <div className="flex justify-between text-[9px] text-gray-400 font-mono"><span>Mix</span><span>{effects.reverb.mix}%</span></div>
                                  <input type="range" min={0} max={100} step={1} value={effects.reverb.mix} onChange={(e) => { pushUndo(); update('reverb', { mix: parseFloat(e.target.value) }); }} className="w-full h-1 bg-black rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#888] [&::-webkit-slider-thumb]:rounded-[1px] cursor-pointer" />
                                </div>
                              )}
                            </div>

                            {/* Delay */}
                            <div className="bg-[#1a1a1a] border border-black rounded-sm p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1"><Waves className="w-3 h-3 text-purple-400" /> Delay</span>
                                <button onClick={() => { pushUndo(); update('delay', { enabled: !effects.delay.enabled }); }} className={`w-7 h-4 rounded-full relative transition-colors ${effects.delay.enabled ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${effects.delay.enabled ? 'left-3.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              {effects.delay.enabled && (
                                <div className="space-y-1">
                                  <select value={effects.delay.time} onChange={(e) => { pushUndo(); update('delay', { time: e.target.value }); }} className="w-full bg-black border border-[#333] rounded-[2px] text-[10px] text-gray-200 p-1 outline-none focus:border-cyan-500">
                                    <option value="1/8">1/8 Note</option>
                                    <option value="1/4">1/4 Note</option>
                                    <option value="1/2">1/2 Note</option>
                                  </select>
                                  <div className="flex justify-between text-[9px] text-gray-400 font-mono"><span>Mix</span><span>{effects.delay.mix}%</span></div>
                                  <input type="range" min={0} max={100} step={1} value={effects.delay.mix} onChange={(e) => { pushUndo(); update('delay', { mix: parseFloat(e.target.value) }); }} className="w-full h-1 bg-black rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#888] [&::-webkit-slider-thumb]:rounded-[1px] cursor-pointer" />
                                </div>
                              )}
                            </div>

                            {/* Saturation */}
                            <div className="bg-[#1a1a1a] border border-black rounded-sm p-2.5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-300 flex items-center gap-1"><Disc className="w-3 h-3 text-orange-400" /> Saturator</span>
                                <button onClick={() => { pushUndo(); update('saturation', { enabled: !effects.saturation.enabled }); }} className={`w-7 h-4 rounded-full relative transition-colors ${effects.saturation.enabled ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${effects.saturation.enabled ? 'left-3.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              {effects.saturation.enabled && (
                                <div>
                                  <div className="flex justify-between text-[9px] text-gray-400 font-mono"><span>Drive</span><span>{effects.saturation.drive}%</span></div>
                                  <input type="range" min={0} max={100} step={1} value={effects.saturation.drive} onChange={(e) => { pushUndo(); update('saturation', { drive: parseFloat(e.target.value) }); }} className="w-full h-1 bg-black rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#888] [&::-webkit-slider-thumb]:rounded-[1px] cursor-pointer" />
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })()}

                    {/* MIXER TAB */}
                    {lowerZoneTab === 'mixer' && (
                      <MixConsole
                        onClose={() => setLowerZoneOpen(false)}
                        isExpanded={lowerZoneHeight > 320}
                        onToggleExpand={() => setLowerZoneHeight(prev => prev === 320 ? 500 : 320)}
                      />
                    )}

                    {/* XAI EXPLAINER TAB */}
                    {lowerZoneTab === 'xai' && (
                      <div className="p-4 overflow-auto h-full">
                        {processedAudioUrl ? (
                          <div className="space-y-4">
                            {/* Export Buttons */}
                            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 rounded-xl border border-emerald-500/20">
                              <Download className="w-5 h-5 text-emerald-400" />
                              <div className="flex-1">
                                <h4 className="text-sm font-bold text-white">Your AI Mix is Ready!</h4>
                                <p className="text-[10px] text-gray-400">Download your mixed audio file</p>
                              </div>
                              <button
                                onClick={() => handleExportMix('wav')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Export WAV
                              </button>
                            </div>

                            {sections && sections.length > 0 && (
                              <MixExplainer
                                sections={sections}
                                currentTime={playheadTime}
                                onSeek={handleSeek}
                                globalSummary={globalSummary}
                                simpleExplanations={simpleExplanations}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                            <Sparkles className="w-10 h-10 mb-3 opacity-30" />
                            <h3 className="text-sm font-bold text-gray-400 mb-1">No AI Mix Generated Yet</h3>
                            <p className="text-xs mb-4">Click the button below to analyze and mix your tracks with AI</p>
                            <button
                              onClick={onMixClick}
                              disabled={tracks.every(t => t.clips.length === 0)}
                              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-[3px] text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center gap-2"
                            >
                              <Waves className="w-4 h-4" /> Generate XAI Mix
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DSP CONTROLS TAB */}
                    {lowerZoneTab === 'dsp' && (
                      <div className="p-4 overflow-auto h-full">
                        <DSPControls />
                      </div>
                    )}

                    {/* VOCAL CHAIN TAB */}
                    {lowerZoneTab === 'vocal' && (
                      <div className="p-4 overflow-auto h-full">
                        <VocalEQGuide
                          eqSettings={eqSettings}
                          onEqChange={setEqSettings}
                        />
                      </div>
                    )}

                    {/* NEW CUBASE-STYLE FEATURES */}
                    {lowerZoneTab === 'channelstrip' && (
                      <ChannelStrip selectedTrackId={selectedTrackId} />
                    )}
                    {lowerZoneTab === 'variaudio' && (
                      <PitchEditor selectedTrackId={selectedTrackId} />
                    )}
                    {lowerZoneTab === 'align' && (
                      <AudioAligner />
                    )}
                  </div>
                </div>
              )}
            </div>
            <TrackInspector trackId={selectedTrackId} pushUndo={pushUndo} />
          </div>

          {/* Bottom Status Bar */}
          <div className="h-7 bg-[#1a1a1a] border-t border-black flex items-center justify-between px-3 text-[9px] text-gray-500 font-mono flex-shrink-0 z-50 relative">
            <div className="flex items-center gap-4">
              <span>Space Play/Pause</span>
              <span>Ctrl+B Split</span>
              <span>Del Remove</span>
              <span>Ctrl+Z Undo</span>
              <span>Ctrl+Y Redo</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Lower Zone Toggle */}
              <button
                onClick={() => { setLowerZoneOpen(!lowerZoneOpen); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-[2px] transition-colors ${lowerZoneOpen ? 'bg-cyan-900/40 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                {lowerZoneOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                Lower Zone
              </button>
              {/* Generate XAI Mix button */}
              <button
                onClick={onMixClick}
                disabled={tracks.every(t => t.clips.length === 0)}
                className="flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white rounded-[2px] font-bold transition-all disabled:opacity-30 shadow-sm"
              >
                <Sparkles className="w-3 h-3" /> XAI Mix
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <ProjectsModal 
        isOpen={isProjectsModalOpen} 
        onClose={() => setIsProjectsModalOpen(false)} 
      />
    </div>
  );
};

export default EditorPage;

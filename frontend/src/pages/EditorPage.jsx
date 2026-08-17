import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioContext } from '../context/AudioContext';
import { useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';
import { 
  Play, Pause, Waves, ArrowRight, Plus, Upload, Music, 
  Volume2, Trash2, Scissors, Undo2, Redo2, Copy, Clipboard, 
  ZoomIn, ZoomOut, Lock, Eye, EyeOff, Mic, Guitar, Drum,
  PlaySquare, Repeat, Settings2, SlidersHorizontal
} from 'lucide-react';
import TrackInspector from '../components/TrackInspector';
import MixConsole from '../components/MixConsole';

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
const Clip = ({ clip, trackColor, onUpdateOffset, onRemove, zoomLevel, isSelected, onSelect, clipDurations, clipWsRefs, playheadTime, trackHeight }) => {
  const containerRef = useRef(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!clip.file || !containerRef.current) return;
    const url = URL.createObjectURL(clip.file);
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: trackColor === 'cyan' || trackColor === 'blue' ? 'rgba(0,200,255,0.6)' : 'rgba(255,120,150,0.6)',
      progressColor: trackColor === 'cyan' || trackColor === 'blue' ? 'rgba(0,220,255,0.9)' : 'rgba(255,150,180,0.9)',
      height: trackHeight - 20, // Leave room for clip header
      normalize: true,
      interact: false,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
    });
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
  }, [clip.file]); // Removed trackHeight from here so we don't reload clip on zoom

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
    rose: 'bg-gradient-to-b from-rose-500/40 to-rose-600/20 border-rose-400/60',
    pink: 'bg-gradient-to-b from-pink-500/40 to-pink-600/20 border-pink-400/60',
    cyan: 'bg-gradient-to-b from-cyan-500/40 to-cyan-600/20 border-cyan-400/60',
    blue: 'bg-gradient-to-b from-blue-500/40 to-blue-600/20 border-blue-400/60',
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0 }}
      dragElastic={0}
      dragMomentum={false}
      onPointerDown={(e) => { onSelect(clip.id); e.stopPropagation(); }}
      onDragEnd={(e, info) => {
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
      className={`absolute top-[2px] bottom-[2px] rounded-[4px] cursor-grab active:cursor-grabbing border overflow-hidden group
        ${bgColors[trackColor] || bgColors.cyan}
        ${isSelected ? 'ring-2 ring-white/90 shadow-[0_0_12px_rgba(255,255,255,0.3)]' : 'shadow-sm'}
      `}
    >
      {/* Clip Header with Name */}
      <div className="absolute top-0 left-0 right-0 h-[16px] bg-black/50 flex items-center justify-between px-1.5 z-10">
        <span className="text-[9px] font-bold text-white truncate leading-none">{clip.name}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(clip.id); }} 
          className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
        >
          <Trash2 className="w-2.5 h-2.5" />
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
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20 hover:bg-white/50 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20 hover:bg-white/50 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
};

// ==========================================
// COMPONENT: Track
// ==========================================
const Track = ({ track, onDropMedia, onUpdateClipOffset, onRemoveClip, zoomLevel, selectedClipId, onSelectClip, onSetPlayhead, clipDurations, clipWsRefs, playheadTime, trackHeight, onMuteToggle, onSoloToggle, onVolumeChange, onSelectTrack, isSelectedTrack }) => {
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
    <div style={{ height: trackHeight }} className={`flex border-b border-[#2a2a2a] ${track.isMuted ? 'opacity-40' : ''}`}>
      {/* Cubase-style Track Header - 160px wide */}
      <div 
        onClick={() => onSelectTrack(track.id)}
        className={`w-[160px] flex-shrink-0 border-r border-[#111] flex flex-col justify-center px-2 py-1 z-30 sticky left-0 shadow-[2px_0_4px_rgba(0,0,0,0.3)] cursor-pointer transition-colors ${isSelectedTrack ? 'bg-[#2a2a2a] border-l-2 border-l-cyan-500' : 'bg-[#222222] hover:bg-[#282828] border-l-2 border-l-transparent'}`}
      >
        
        {/* Top row: Name & Lock */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
             {trackIcons[track.color]}
             <span className="text-[10px] font-bold text-gray-200 truncate">{track.name}</span>
          </div>
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${isLocked ? 'bg-yellow-500/30 text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Lock className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Middle row: Mute & Solo */}
        <div className="flex items-center gap-1 mb-2">
          <button 
            onClick={() => onMuteToggle(track.id)}
            className={`w-6 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors border ${track.isMuted ? 'bg-yellow-600 border-yellow-500 text-white shadow-[0_0_8px_rgba(202,138,4,0.4)]' : 'bg-[#333] border-[#444] text-gray-400 hover:bg-[#444]'}`}
          >
            M
          </button>
          <button 
            onClick={() => onSoloToggle(track.id)}
            className={`w-6 h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors border ${track.isSoloed ? 'bg-red-600 border-red-500 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]' : 'bg-[#333] border-[#444] text-gray-400 hover:bg-[#444]'}`}
          >
            S
          </button>
        </div>

        {/* Bottom row: Volume Slider */}
        <div className="flex items-center gap-1.5 bg-[#1a1a1a] p-1 rounded border border-[#333]">
          <Volume2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input 
            type="range" min="0" max="1" step="0.01" 
            value={track.volume !== undefined ? track.volume : 1} 
            onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
            className="flex-1 h-1 bg-[#444] rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:bg-cyan-400 transition-all"
          />
        </div>
      </div>

      {/* Track Arrange Area */}
      <div 
        ref={trackRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerDown={handleTrackClick}
        className="flex-1 relative bg-[#1a1a1a] hover:bg-[#1c1c1c] transition-colors overflow-hidden"
      >
        {track.clips.map(clip => (
          <Clip 
            key={clip.id} clip={clip} trackColor={track.color} 
            onUpdateOffset={isLocked ? () => {} : onUpdateClipOffset}
            onRemove={isLocked ? () => {} : onRemoveClip}
            zoomLevel={zoomLevel} isSelected={selectedClipId === clip.id} onSelect={onSelectClip}
            clipDurations={clipDurations} clipWsRefs={clipWsRefs} playheadTime={playheadTime}
            trackHeight={trackHeight}
          />
        ))}
        {track.clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-20 transition-opacity pointer-events-none">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Drop audio here</span>
          </div>
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
          <path d="M1 1H10V8L5.5 14L1 8V1Z" fill="#141414" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
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
    mediaPool, addMediaToPool, tracks, setTracks, 
    handleMix, isLoading, loadingStage, automationData
  } = useAudioContext();
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const clipDurations = useRef({});
  const clipWsRefs = useRef({}); // Store references to wavesurfer instances for playback control

  // DAW View State
  const [zoomLevel, setZoomLevel] = useState(50);
  const [trackHeight, setTrackHeight] = useState(72); // Dynamic track height
  const [showMixer, setShowMixer] = useState(false);
  const [mixerExpanded, setMixerExpanded] = useState(false);

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

  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  const loopLeftRef = useRef(loopLeft);
  useEffect(() => { loopLeftRef.current = loopLeft; }, [loopLeft]);
  const loopRightRef = useRef(loopRight);
  useEffect(() => { loopRightRef.current = loopRight; }, [loopRight]);

  const seekRequestRef = useRef(null);
  const handleSeek = useCallback((time) => {
    seekRequestRef.current = time;
    setPlayheadTime(time);
  }, []);

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
              // Apply volume (0.0 to 1.0)
              if (ws.getVolume() !== trackVol) ws.setVolume(trackVol);

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
    }
  }, [playheadTime, isPlaying]);


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

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA') return;

      // Spacebar -> Play / Pause
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setIsPlaying(prev => !prev);
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
  }, [selectedClipId, playheadTime, tracks, clipboard, pushUndo, handleUndo, handleRedo, handleSeek]);

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

  const handleRemoveClip = (clipId) => {
    setTracks(prev => prev.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) })));
  };

  const handleSplitClip = (clipId, splitTime) => {
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
  };

  const onMixClick = async () => {
    setIsPlaying(false);
    const success = await handleMix();
    if (success) {
      navigate('/dashboard');
    }
  };

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

  return (
    <div className="h-screen w-full overflow-x-auto overflow-y-hidden bg-[#141414] text-white">
      <div className="flex h-full min-w-[1024px]">
        
        {/* LEFT SIDEBAR: Media Pool */}
        <div className="w-56 flex-shrink-0 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col z-50 relative">
        <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between">
          <h2 className="font-bold text-sm text-gray-300 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-cyan-400" />
            Media
          </h2>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-7 h-7 rounded bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center text-cyan-400 transition-colors"
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
                    className="p-2 bg-[#222] hover:bg-[#2a2a2a] rounded cursor-grab active:cursor-grabbing border border-[#333] flex items-center gap-2 transition-colors"
                  >
                    <div className={`w-1.5 h-6 rounded-full ${media.type === 'vocal' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-200 truncate">{media.name}</p>
                      <p className="text-[9px] text-gray-500 uppercase">{media.type}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* MAIN ARRANGE WINDOW */}
      <div className="flex-1 flex flex-col min-w-[500px] bg-[#141414] relative z-40">
        
        {/* Top Toolbar - Cubase / CapCut style */}
        <div className="h-10 bg-[#1e1e1e] border-b border-[#2a2a2a] flex items-center justify-between px-3 z-50 relative shadow-sm">
          {/* Left: Play/Pause and Tools */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors mr-2 ${isPlaying ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-white/10'}`}
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div className="w-px h-5 bg-[#333] mr-2" />
            
            {/* Loop Toggle */}
            <button 
              onClick={() => setIsLooping(!isLooping)}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors mr-2 ${isLooping ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              title="Cycle/Loop Mode"
            >
              <Repeat className="w-4 h-4" />
            </button>

            <button onClick={handleUndo} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${undoStack.length > 0 ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600'}`} title="Undo (Ctrl+Z)">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRedo} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${redoStack.length > 0 ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600'}`} title="Redo (Ctrl+Y)">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-[#333] mx-1" />
            <button 
              onClick={() => { if (selectedClipId) { pushUndo(); handleSplitClip(selectedClipId, playheadTime); } }}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${selectedClipId ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600'}`} 
              title="Split (Ctrl+B)"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => { if (selectedClipId) { pushUndo(); handleRemoveClip(selectedClipId); setSelectedClipId(null); } }}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${selectedClipId ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600'}`} 
              title="Delete (Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-[#333] mx-1" />
            <button 
              onClick={() => setShowMixer(!showMixer)}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${showMixer ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-white/10'}`} 
              title="Toggle MixConsole"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Center: Timecode */}
          <div className="text-[11px] font-mono text-white bg-black/50 px-3 py-1 rounded border border-[#333]">
            {formatTimecode(playheadTime)}
          </div>
          
          {/* Right: Zoom + Mix */}
          <div className="flex items-center gap-2">
            
            {/* Vertical Track Height Slider */}
            <div className="flex items-center gap-1.5 bg-black/30 rounded px-2 py-1 border border-[#2a2a2a]">
              <Settings2 className="w-3 h-3 text-gray-500" />
              <input 
                type="range" min="40" max="150" value={trackHeight} onChange={(e) => setTrackHeight(parseInt(e.target.value))}
                className="w-16 h-1 bg-[#444] rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                title="Track Height"
              />
            </div>

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
              onClick={onMixClick}
              disabled={tracks.every(t => t.clips.length === 0)}
              className="h-7 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded text-xs font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ml-2"
            >
              <Waves className="w-3.5 h-3.5" />
              Generate XAI Mix <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Unified Scroll Container for Ruler and Tracks */}
        <div 
          className="flex-1 overflow-auto relative" 
          ref={scrollContainerRef}
        >
          <div style={{ width: timelineWidth, minHeight: '100%' }} className="relative flex flex-col">
            
            {/* Ruler Row (Sticky Top) */}
            <div className="flex sticky top-0 z-40 bg-[#1a1a1a]">
              {/* Spacer above track headers (Sticky Left) */}
              <div className="w-[160px] flex-shrink-0 border-r border-[#2a2a2a] border-b border-[#333] sticky left-0 z-50 bg-[#1a1a1a]" />
              <div className="flex-1">
                <TimelineRuler 
                  zoomLevel={zoomLevel} playheadTime={playheadTime} onClickRuler={handleSeek} timelineWidth={timelineWidth}
                  isLooping={isLooping} loopLeft={loopLeft} loopRight={loopRight}
                  onUpdateLoop={(l, r) => { setLoopLeft(l); setLoopRight(r); }}
                />
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
              />
            ))}

            {/* Global Playhead Line (Offset by 160px for the sticky track headers) */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-white z-30 pointer-events-none"
              style={{ left: 160 + playheadTime * zoomLevel }}
            />
          </div>
        </div>

        {showMixer && (
          <MixConsole 
            onClose={() => setShowMixer(false)} 
            isExpanded={mixerExpanded} 
            onToggleExpand={() => setMixerExpanded(!mixerExpanded)} 
          />
        )}

        {/* Bottom Shortcuts Bar */}
        <div className="h-7 bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center px-3 gap-4 text-[9px] text-gray-500 font-mono flex-shrink-0 z-50 relative">
          <span>Space Play/Pause</span>
          <span>Ctrl+B Split</span>
          <span>Del Remove</span>
          <span>Ctrl+C Copy</span>
          <span>Ctrl+V Paste</span>
          <span>Ctrl+Z Undo</span>
          <span>Ctrl+Y Redo</span>
          <span>Ctrl+Scroll Zoom</span>
        </div>
      </div>
      
      {/* NEW RIGHT SIDEBAR: Track Inspector */}
      <TrackInspector trackId={selectedTrackId} pushUndo={pushUndo} />
      </div>
    </div>
  );
};

export default EditorPage;

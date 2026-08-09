import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioContext } from '../context/AudioContext';
import { useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Waves, ArrowRight, Plus, Upload, Music, Volume2, Settings2, Trash2 } from 'lucide-react';

// Remove constant, we will pass zoomLevel
// const PX_PER_SEC = 50;

// ==========================================
// COMPONENT: Clip
// Represents a single audio region on a track
// ==========================================
const Clip = ({ clip, trackColor, onUpdateOffset, onRemove, zoomLevel, isSelected, onSelect }) => {
  const containerRef = useRef(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!clip.file || !containerRef.current) return;
    const url = URL.createObjectURL(clip.file);
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255,255,255,0.4)',
      progressColor: 'rgba(255,255,255,0.8)',
      height: 60,
      normalize: true,
      interact: false,
    });
    ws.load(url);
    ws.on('ready', () => setDuration(ws.getDuration()));
    return () => {
      ws.destroy();
      URL.revokeObjectURL(url);
    };
  }, [clip.file]);

  const clipDuration = (clip.trimEndSec || duration) - (clip.trimStartSec || 0);
  const width = clipDuration > 0 ? clipDuration * zoomLevel : 200; // placeholder width while loading

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0 }}
      dragElastic={0}
      dragMomentum={false}
      onPointerDown={(e) => {
        onSelect(clip.id);
        e.stopPropagation(); // prevent track click
      }}
      onDragEnd={(e, info) => {
        const newX = Math.max(0, clip.offset * zoomLevel + info.offset.x);
        onUpdateOffset(clip.id, newX / zoomLevel);
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, x: clip.offset * zoomLevel }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
      style={{ width }}
      className={`absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing border overflow-hidden shadow-md group
        ${trackColor === 'rose' ? 'bg-rose-500/30 border-rose-400' : ''}
        ${trackColor === 'pink' ? 'bg-pink-500/30 border-pink-400' : ''}
        ${trackColor === 'cyan' ? 'bg-cyan-500/30 border-cyan-400' : ''}
        ${trackColor === 'blue' ? 'bg-blue-500/30 border-blue-400' : ''}
        ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}
      `}
    >
      <div className="absolute top-0 left-0 right-0 h-4 bg-black/40 flex items-center justify-between px-2 text-[9px] font-bold text-white z-10 uppercase tracking-wider">
        <span className="truncate">{clip.name}</span>
        <button onClick={(e) => { e.stopPropagation(); onRemove(clip.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="w-full h-full overflow-hidden relative">
        <div 
           ref={containerRef} 
           className="h-full pt-4 opacity-80 absolute top-0" 
           style={{ 
             left: -(clip.trimStartSec || 0) * zoomLevel, 
             width: duration * zoomLevel 
           }} 
        />
      </div>
    </motion.div>
  );
};

// ==========================================
// COMPONENT: Track
// Represents a horizontal lane in the DAW
// ==========================================
const Track = ({ track, onDropMedia, onUpdateClipOffset, onRemoveClip, zoomLevel, selectedClipId, onSelectClip, onSetPlayhead }) => {
  const trackRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const mediaId = e.dataTransfer.getData('application/json');
    if (!mediaId) return;

    // Calculate drop offset in seconds
    const rect = trackRef.current.getBoundingClientRect();
    const xPos = Math.max(0, e.clientX - rect.left);
    const offsetSecs = xPos / zoomLevel;

    onDropMedia(track.id, mediaId, offsetSecs);
  };
  
  const handleTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const xPos = Math.max(0, e.clientX - rect.left);
    onSetPlayhead(xPos / zoomLevel);
    onSelectClip(null); // deselect clips
  };

  return (
    <div className="flex border-b border-white/10 h-24 bg-black/20 group">
      {/* Track Header */}
      <div className="w-48 flex-shrink-0 bg-black/60 border-r border-white/10 p-3 flex flex-col justify-between shadow-[4px_0_10px_rgba(0,0,0,0.2)] z-20">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full bg-${track.color}-500 shadow-[0_0_8px_currentColor]`} />
          <span className="font-bold text-sm text-gray-200 truncate">{track.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          <button className="w-6 h-6 rounded bg-white/5 flex items-center justify-center hover:bg-white/10 text-xs font-bold text-white">M</button>
          <button className="w-6 h-6 rounded bg-white/5 flex items-center justify-center hover:bg-yellow-500/30 hover:text-yellow-400 text-xs font-bold text-white transition-colors">S</button>
          <Volume2 className="w-4 h-4 ml-auto text-gray-400" />
        </div>
      </div>

      {/* Track Arrange Area */}
      <div 
        ref={trackRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerDown={handleTrackClick}
        className="flex-1 relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iMTAwJSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] hover:bg-white/[0.02] transition-colors"
      >
        {track.clips.map(clip => (
          <Clip 
            key={clip.id} 
            clip={clip} 
            trackColor={track.color} 
            onUpdateOffset={onUpdateClipOffset}
            onRemove={onRemoveClip}
            zoomLevel={zoomLevel}
            isSelected={selectedClipId === clip.id}
            onSelect={onSelectClip}
          />
        ))}
        {track.clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
            <span className="text-sm font-semibold uppercase tracking-widest text-white">Drop audio here</span>
          </div>
        )}
        {/* Render Automation Lane if available */}
        <AutomationLane 
          data={track.automation} 
          color={track.color} 
          zoomLevel={zoomLevel}
        />
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: AutomationLane
// Draws the AI-generated gain curve over the track
// ==========================================
const AutomationLane = ({ data, color, zoomLevel }) => {
  if (!data || data.length === 0) return null;

  const mapY = (db) => {
    const clamped = Math.max(-20, Math.min(10, db));
    const ratio = (clamped + 20) / 30;
    return 96 - (ratio * 96);
  };

  const points = data.map(d => `${d.time * zoomLevel},${mapY(d.gainDb)}`).join(' ');

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <svg className="w-full h-full overflow-visible">
        <polyline 
          points={points}
          fill="none"
          stroke={color === 'rose' ? '#fda4af' : '#67e8f9'}
          strokeWidth="2"
          className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          strokeOpacity="0.8"
        />
        {data.map((d, i) => (
          <circle 
            key={i}
            cx={d.time * zoomLevel}
            cy={mapY(d.gainDb)}
            r="3"
            fill="white"
            className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]"
          />
        ))}
      </svg>
    </div>
  );
};

// ==========================================
// MAIN EDITOR PAGE
// ==========================================
const EditorPage = () => {
  const { 
    mediaPool, addMediaToPool, 
    tracks, setTracks, 
    handleMix, isLoading, loadingStage,
    automationData
  } = useAudioContext();
  
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [zoomLevel, setZoomLevel] = useState(50); // pixels per sec
  const [playheadTime, setPlayheadTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState(null);

  // Keyboard Shortcuts (CapCut Style)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedClipId) {
        handleRemoveClip(selectedClipId);
        setSelectedClipId(null);
      }
      
      // Ctrl+B (or Cmd+B) to split
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && selectedClipId) {
        e.preventDefault();
        handleSplitClip(selectedClipId, playheadTime);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, playheadTime, tracks]);

  // Timeline Zooming (Ctrl+Scroll)
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -5 : 5;
      setZoomLevel(prev => Math.max(10, Math.min(200, prev + zoomDelta)));
    }
  };

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

    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          clips: [...t.clips, {
            id: `clip_${Date.now()}`,
            mediaId,
            file: media.file,
            name: media.name,
            offset
          }]
        };
      }
      return t;
    }));
  };

  const handleUpdateClipOffset = (clipId, newOffset) => {
    setTracks(prev => prev.map(t => ({
      ...t,
      clips: t.clips.map(c => c.id === clipId ? { ...c, offset: newOffset } : c)
    })));
  };

  const handleRemoveClip = (clipId) => {
    setTracks(prev => prev.map(t => ({
      ...t,
      clips: t.clips.filter(c => c.id !== clipId)
    })));
  };

  const handleSplitClip = (clipId, splitTime) => {
    setTracks(prev => prev.map(t => {
      const clipIndex = t.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return t;

      const clip = t.clips[clipIndex];
      // Check if splitTime falls inside the clip
      const clipDuration = (clip.trimEndSec || 999999) - (clip.trimStartSec || 0); // we don't strictly know original duration here without context, but we can assume we split by timeline position
      
      const clipStart = clip.offset;
      const clipEnd = clip.offset + clipDuration;

      if (splitTime <= clipStart || splitTime >= clipEnd) return t; // Playhead not over this clip

      // Calculate relative split point inside the clip's audio file
      const splitOffsetInsideClip = splitTime - clipStart;
      const newTrimMidpoint = (clip.trimStartSec || 0) + splitOffsetInsideClip;

      const leftClip = {
        ...clip,
        trimEndSec: newTrimMidpoint
      };

      const rightClip = {
        ...clip,
        id: `clip_${Date.now()}_right`,
        offset: splitTime,
        trimStartSec: newTrimMidpoint
      };

      const newClips = [...t.clips];
      newClips.splice(clipIndex, 1, leftClip, rightClip);

      return {
        ...t,
        clips: newClips
      };
    }));
  };

  const onMixClick = async () => {
    const success = await handleMix();
    // if (success) navigate('/dashboard'); // We don't navigate anymore! We stay in the DAW to view the automation lanes!
  };

  useEffect(() => {
    if (automationData) {
      setTracks(prev => prev.map(t => ({
        ...t,
        automation: t.type === 'vocal' ? automationData.vocal : automationData.instrumental
      })));
    }
  }, [automationData, setTracks]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center -mt-20">
        <div className="text-center">
          <div className="w-24 h-24 border-[4px] border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-xl font-bold text-white mb-2">AI is Mixing Your Project...</h3>
          <p className="text-gray-400">{loadingStage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-[#0a0a0a]">
      
      {/* LEFT SIDEBAR: Media Pool */}
      <div className="w-64 bg-[#111] border-r border-white/10 flex flex-col shadow-2xl z-30">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-bold text-gray-200 flex items-center gap-2">
            <Music className="w-4 h-4 text-blue-400" />
            Media Pool
          </h2>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 rounded-full bg-blue-500/20 hover:bg-blue-500/40 flex items-center justify-center text-blue-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="audio/*" 
            className="hidden" 
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mediaPool.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-50">
              <Upload className="w-8 h-8 mb-2 text-gray-400" />
              <p className="text-xs text-gray-400">Click the + button to import audio stems</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {mediaPool.map(media => (
                  <motion.div
                    key={media.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    draggable
                    onDragStart={(e) => handleDragStartMedia(e, media.id)}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-grab active:cursor-grabbing border border-white/5 flex items-center gap-3 transition-colors"
                  >
                    <div className={`w-2 h-8 rounded-full ${media.type === 'vocal' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-200 truncate">{media.name}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{media.type}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* MAIN ARRANGE WINDOW */}
      <div className="flex-1 flex flex-col bg-[#161616]">
        {/* Toolbar */}
        <div className="h-14 bg-[#1a1a1a] border-b border-white/10 flex items-center justify-between px-6 shadow-md z-20">
          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors">
              <Play className="w-4 h-4 ml-1" />
            </button>
            <div className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-md border border-blue-500/20">
              00:00:00.00
            </div>
          </div>
          
          <button
            onClick={onMixClick}
            className="group flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all"
          >
            <Waves className="w-4 h-4" />
            Analyze & Generate Mix
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Timeline Header */}
        <div className="flex h-8 bg-[#111] border-b border-white/5 overflow-hidden">
          <div className="w-48 flex-shrink-0 border-r border-white/10" />
          <div className="flex-1 relative opacity-40">
            {[...Array(50)].map((_, i) => (
              <div key={i} className="absolute text-[9px] font-mono text-gray-300 top-1.5" style={{ left: i * 5 * zoomLevel }}>
                {i * 5}s
              </div>
            ))}
          </div>
        </div>

        {/* Tracks Area */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden relative"
          onWheel={handleWheel}
        >
          {tracks.map(track => (
            <Track 
              key={track.id} 
              track={track} 
              onDropMedia={handleDropMedia}
              onUpdateClipOffset={handleUpdateClipOffset}
              onRemoveClip={handleRemoveClip}
              zoomLevel={zoomLevel}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              onSetPlayhead={setPlayheadTime}
            />
          ))}
          
          {/* Add Track Button */}
          <div className="h-16 flex items-center px-4 opacity-50 hover:opacity-100 transition-opacity cursor-pointer border-b border-white/5">
            <Plus className="w-4 h-4 mr-2" />
            <span className="text-sm font-semibold">Add Track</span>
          </div>

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 pointer-events-none"
            style={{ left: playheadTime * zoomLevel }}
          >
            <div className="absolute -top-1 -left-2 border-[6px] border-transparent border-t-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;

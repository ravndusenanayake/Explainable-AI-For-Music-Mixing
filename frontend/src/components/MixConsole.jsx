import React, { useRef, useState } from 'react';
import { useAudioContext } from '../context/AudioContext';
import { Mic, Guitar, Drum, Volume2, Maximize2, Minimize2, X, SlidersHorizontal } from 'lucide-react';

const trackIcons = {
  rose: <Mic className="w-4 h-4 text-rose-400" />,
  pink: <Mic className="w-4 h-4 text-pink-400" />,
  cyan: <Guitar className="w-4 h-4 text-cyan-400" />,
  blue: <Drum className="w-4 h-4 text-blue-400" />,
};

const PanKnob = ({ value, onChange }) => {
  // value from -1 to 1
  const rotation = value * 135; // max 135 deg left/right

  const handlePointerDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = value;

    const onPointerMove = (eMove) => {
      const deltaY = startY - eMove.clientY;
      const newValue = Math.max(-1, Math.min(1, startValue + deltaY * 0.01));
      onChange(newValue);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="flex flex-col items-center gap-1 mb-3">
      <div 
        className="w-8 h-8 rounded-full bg-[#111] border-2 border-[#333] relative cursor-ns-resize shadow-inner group"
        onPointerDown={handlePointerDown}
        onDoubleClick={() => onChange(0)}
        title="Pan (Drag up/down)"
      >
        <div 
          className="absolute w-[2px] h-3 bg-white left-1/2 -ml-[1px] bottom-1/2 origin-bottom transition-transform duration-75"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </div>
      <span className="text-[9px] font-mono text-gray-500">
        {value === 0 ? 'C' : value < 0 ? `L${Math.round(-value * 100)}` : `R${Math.round(value * 100)}`}
      </span>
    </div>
  );
};

const ChannelStrip = ({ track, onVolumeChange, onPanChange, onMute, onSolo }) => {
  return (
    <div className="w-24 flex-shrink-0 bg-[#161616] border-r border-black flex flex-col items-center pt-3 pb-1 relative h-full shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)]">
      
      {/* Pan Control */}
      <PanKnob value={track.pan || 0} onChange={onPanChange} />
      
      {/* Mute / Solo */}
      <div className="flex gap-1 mb-4">
        <button 
          onClick={onMute}
          className={`w-7 h-6 rounded-[2px] flex items-center justify-center text-[10px] font-bold transition-colors border shadow-inner ${track.isMuted ? 'bg-[#eab308] border-[#ca8a04] text-black' : 'bg-[#1a1a1a] border-[#000] text-[#777] hover:bg-[#222]'}`}
        >
          M
        </button>
        <button 
          onClick={onSolo}
          className={`w-7 h-6 rounded-[2px] flex items-center justify-center text-[10px] font-bold transition-colors border shadow-inner ${track.isSoloed ? 'bg-[#ef4444] border-[#dc2626] text-white' : 'bg-[#1a1a1a] border-[#000] text-[#777] hover:bg-[#222]'}`}
        >
          S
        </button>
      </div>

      {/* Fader Area */}
      <div className="flex-1 relative w-full flex justify-center mb-2 min-h-[150px]">
        {/* Fader Track */}
        <div className="w-2 h-full bg-[#0a0a0a] rounded-full border border-[#222] relative flex justify-center">
           {/* Fader Thumb (styled range input) */}
           <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={track.volume !== undefined ? track.volume : 1}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-[30px] h-[30px] z-10 appearance-none bg-transparent cursor-pointer mix-fader"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              WebkitAppearance: 'slider-vertical',
              height: '100%'
            }}
          />
          {/* Custom thumb visual overlay handled by CSS in index.css */}
        </div>
        
        {/* Simple mock meter (Visual only) */}
        <div className="absolute right-4 top-0 bottom-0 w-1 bg-black rounded-full overflow-hidden">
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75" style={{ height: `${(track.volume || 0) * (Math.random() * 20 + 60)}%`, opacity: (track.isMuted || (track.volume === 0)) ? 0 : 0.8 }} />
        </div>
      </div>
      
      {/* Value Display */}
      <div className="text-[10px] font-mono text-cyan-400/80 mb-2 bg-black px-2 py-0.5 rounded-[2px] border border-[#222]">
        {Math.round((track.volume || 1) * 100)}%
      </div>

      {/* Track Label */}
      <div className="w-full px-1.5 mt-auto">
        <div className={`w-full py-1 rounded-[2px] bg-[#1a1a1a] border border-black flex flex-col items-center overflow-hidden border-b-[3px] shadow-sm ${
          track.color === 'cyan' ? 'border-b-cyan-600' :
          track.color === 'rose' ? 'border-b-rose-600' :
          track.color === 'pink' ? 'border-b-pink-600' :
          track.color === 'blue' ? 'border-b-blue-600' : 'border-b-gray-600'
        }`}>
          {trackIcons[track.color]}
          <span className="text-[9px] font-bold text-gray-300 truncate w-full text-center mt-0.5">{track.name}</span>
        </div>
      </div>
    </div>
  );
};

const MasterStrip = ({ volume, onVolumeChange }) => {
  return (
    <div className="w-28 flex-shrink-0 bg-[#222] border-l border-black flex flex-col items-center pt-4 pb-2 relative h-full shadow-[-4px_0_15px_rgba(0,0,0,0.5)] z-10">
      
      <div className="text-xs font-bold text-gray-400 mb-8 tracking-widest">MASTER</div>
      
      {/* Fader Area */}
      <div className="flex-1 relative w-full flex justify-center mb-2 min-h-[150px]">
        {/* Fader Track */}
        <div className="w-2.5 h-full bg-[#0a0a0a] rounded-full border border-[#111] relative flex justify-center">
           <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-[30px] h-[30px] z-10 appearance-none bg-transparent cursor-pointer mix-fader master"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              WebkitAppearance: 'slider-vertical',
              height: '100%'
            }}
          />
        </div>
        
        {/* Stereo Meters */}
        <div className="absolute right-4 top-0 bottom-0 w-2.5 flex gap-0.5">
          <div className="w-1 h-full bg-black rounded-full overflow-hidden relative">
            <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75" style={{ height: `${volume * (Math.random() * 15 + 70)}%` }} />
          </div>
          <div className="w-1 h-full bg-black rounded-full overflow-hidden relative">
            <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75 delay-75" style={{ height: `${volume * (Math.random() * 15 + 70)}%` }} />
          </div>
        </div>
      </div>

      <div className="text-[10px] font-mono text-cyan-400 mb-2 font-bold">
        {Math.round((volume || 1) * 100)}%
      </div>

      <div className="w-full px-2 mt-auto">
        <div className="w-full py-2 rounded bg-gradient-to-b from-red-900/50 to-red-950/80 border border-red-900 flex justify-center shadow-inner">
          <span className="text-[10px] font-bold text-red-200 uppercase">Stereo Out</span>
        </div>
      </div>
    </div>
  );
};

const MixConsole = ({ onClose, isExpanded, onToggleExpand }) => {
  const { tracks, setTracks, updateTrackPan, masterVolume, setMasterVolume } = useAudioContext();

  const handleVolumeChange = (trackId, vol) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume: vol } : t));
  };
  const handleMuteToggle = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isMuted: !t.isMuted } : t));
  };
  const handleSoloToggle = (trackId) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isSoloed: !t.isSoloed } : t));
  };

  return (
    <div className={`w-full bg-[#111] border-t-2 border-black flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.8)] transition-all duration-300 ${isExpanded ? 'h-96' : 'h-64'} z-50 relative`}>
      
      {/* Mixer Toolbar */}
      <div className="h-8 bg-gradient-to-b from-[#2d2d2d] to-[#222] border-b border-black flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#a0a0a0]" />
          <span className="text-[10px] font-bold text-gray-200 tracking-widest uppercase">MixConsole</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggleExpand} className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded transition-colors ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mixer Channels */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex bg-[#161616]">
        <div className="flex flex-1 min-w-max">
          {tracks.map(track => (
            <ChannelStrip 
              key={track.id} 
              track={track} 
              onVolumeChange={(v) => handleVolumeChange(track.id, v)}
              onPanChange={(p) => updateTrackPan(track.id, p)}
              onMute={() => handleMuteToggle(track.id)}
              onSolo={() => handleSoloToggle(track.id)}
            />
          ))}
          {/* Empty space filler with metal texture look */}
          <div className="flex-1 min-w-[50px] bg-[repeating-linear-gradient(90deg,#161616,#161616_2px,#181818_2px,#181818_4px)]" />
        </div>
        
        {/* Master Channel Fixed Right */}
        <div className="sticky right-0 h-full border-l-[3px] border-[#0a0a0a]">
          <MasterStrip volume={masterVolume} onVolumeChange={setMasterVolume} />
        </div>
      </div>
    </div>
  );
};

export default MixConsole;

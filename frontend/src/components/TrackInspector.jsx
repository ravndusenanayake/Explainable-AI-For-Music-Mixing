import React from 'react';
import { Settings, Sliders, Waves, Wind, Zap, Disc } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const Toggle = ({ checked, onChange, onInteract }) => (
  <button 
    onClick={() => { if (onInteract) onInteract(); onChange(!checked); }}
    className={`w-8 h-4 rounded-full relative transition-colors ${checked ? 'bg-cyan-500' : 'bg-gray-600'}`}
  >
    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${checked ? 'left-4.5 right-0.5' : 'left-0.5'}`} />
  </button>
);

const Slider = ({ value, min, max, step, onChange, onInteract, label, unit }) => (
  <div className="flex flex-col gap-1 mt-2">
    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
      <span>{label}</span>
      <span>{value}{unit}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value} 
      onPointerDown={() => { if (onInteract) onInteract(); }}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-[#444] rounded appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer hover:[&::-webkit-slider-thumb]:bg-cyan-400 transition-all"
    />
  </div>
);

const TrackInspector = ({ trackId, pushUndo }) => {
  const { tracks, updateTrackEffect } = useAudioContext();
  const track = tracks.find(t => t.id === trackId);

  if (!track || !track.effects) {
    return (
      <div className="w-64 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col justify-center items-center text-gray-500 text-xs p-4 text-center">
        Select a track to view its effect rack.
      </div>
    );
  }

  const { effects } = track;
  const update = (effectKey, updates) => updateTrackEffect(trackId, effectKey, updates);
  
  const handleInteract = () => {
    if (pushUndo) pushUndo();
  };

  return (
    <div className="w-64 flex-shrink-0 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col z-50 h-full overflow-hidden">
      <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between bg-[#222]">
        <h2 className="font-bold text-sm text-gray-200 flex items-center gap-1.5 truncate">
          <Settings className="w-3.5 h-3.5 text-cyan-400" />
          {track.name} FX
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* EQ Section */}
        <div className="bg-[#222] border border-[#333] rounded p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5"><Sliders className="w-3.5 h-3.5 text-rose-400" /> EQ</span>
            <Toggle checked={effects.eq.enabled} onChange={(val) => update('eq', { enabled: val })} onInteract={handleInteract} />
          </div>
          {effects.eq.enabled && (
            <div className="space-y-1">
              <Slider label="Low-Cut" value={effects.eq.highPass} min={20} max={200} step={1} unit="Hz" onChange={(val) => update('eq', { highPass: val })} onInteract={handleInteract} />
              <Slider label="Presence" value={effects.eq.presence} min={-5} max={10} step={0.5} unit="dB" onChange={(val) => update('eq', { presence: val })} onInteract={handleInteract} />
            </div>
          )}
        </div>

        {/* De-Esser Section */}
        <div className="bg-[#222] border border-[#333] rounded p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5"><Wind className="w-3.5 h-3.5 text-cyan-400" /> De-Esser</span>
            <Toggle checked={effects.deEsser.enabled} onChange={(val) => update('deEsser', { enabled: val })} onInteract={handleInteract} />
          </div>
          {effects.deEsser.enabled && (
            <Slider label="Amount" value={effects.deEsser.amount} min={0} max={100} step={1} unit="%" onChange={(val) => update('deEsser', { amount: val })} onInteract={handleInteract} />
          )}
        </div>

        {/* Compressor Section */}
        <div className="bg-[#222] border border-[#333] rounded p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400" /> Compressor</span>
            <Toggle checked={effects.compressor.enabled} onChange={(val) => update('compressor', { enabled: val })} onInteract={handleInteract} />
          </div>
          {effects.compressor.enabled && (
            <div className="space-y-1">
              <Slider label="Threshold" value={effects.compressor.threshold} min={-40} max={0} step={0.5} unit="dB" onChange={(val) => update('compressor', { threshold: val })} onInteract={handleInteract} />
              <Slider label="Ratio" value={effects.compressor.ratio} min={1} max={10} step={0.1} unit=":1" onChange={(val) => update('compressor', { ratio: val })} onInteract={handleInteract} />
            </div>
          )}
        </div>

        {/* Reverb Section */}
        <div className="bg-[#222] border border-[#333] rounded p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5"><Waves className="w-3.5 h-3.5 text-blue-400" /> Reverb</span>
            <Toggle checked={effects.reverb.enabled} onChange={(val) => update('reverb', { enabled: val })} onInteract={handleInteract} />
          </div>
          {effects.reverb.enabled && (
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                <span>Type</span>
              </div>
              <select 
                value={effects.reverb.type} 
                onMouseDown={handleInteract}
                onChange={(e) => update('reverb', { type: e.target.value })}
                className="w-full bg-[#111] border border-[#444] rounded text-xs text-gray-200 p-1 outline-none focus:border-cyan-500"
              >
                <option value="room">Room</option>
                <option value="plate">Plate</option>
                <option value="hall">Hall</option>
              </select>
              <Slider label="Mix" value={effects.reverb.mix} min={0} max={100} step={1} unit="%" onChange={(val) => update('reverb', { mix: val })} onInteract={handleInteract} />
            </div>
          )}
        </div>

        {/* Delay Section */}
        <div className="bg-[#222] border border-[#333] rounded p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5"><Waves className="w-3.5 h-3.5 text-purple-400" /> Delay</span>
            <Toggle checked={effects.delay.enabled} onChange={(val) => update('delay', { enabled: val })} onInteract={handleInteract} />
          </div>
          {effects.delay.enabled && (
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                <span>Sync</span>
              </div>
              <select 
                value={effects.delay.time} 
                onMouseDown={handleInteract}
                onChange={(e) => update('delay', { time: e.target.value })}
                className="w-full bg-[#111] border border-[#444] rounded text-xs text-gray-200 p-1 outline-none focus:border-cyan-500"
              >
                <option value="1/8">1/8 Note</option>
                <option value="1/4">1/4 Note</option>
                <option value="1/2">1/2 Note</option>
              </select>
              <Slider label="Mix" value={effects.delay.mix} min={0} max={100} step={1} unit="%" onChange={(val) => update('delay', { mix: val })} onInteract={handleInteract} />
            </div>
          )}
        </div>

        {/* Saturation Section */}
        <div className="bg-[#222] border border-[#333] rounded p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5"><Disc className="w-3.5 h-3.5 text-orange-400" /> Saturation</span>
            <Toggle checked={effects.saturation.enabled} onChange={(val) => update('saturation', { enabled: val })} onInteract={handleInteract} />
          </div>
          {effects.saturation.enabled && (
            <Slider label="Drive" value={effects.saturation.drive} min={0} max={100} step={1} unit="%" onChange={(val) => update('saturation', { drive: val })} onInteract={handleInteract} />
          )}
        </div>
        
      </div>
    </div>
  );
};

export default TrackInspector;

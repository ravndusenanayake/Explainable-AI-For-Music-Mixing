import React from 'react';
import { motion } from 'framer-motion';
import { Sliders, Waves, Info } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const DSPControls = ({ selectedTrackId }) => {
  const { tracks, updateTrackEffect } = useAudioContext();
  const track = tracks.find(t => t.id === selectedTrackId);
  const effects = track?.effects || {};

  const eq = effects.eq || { lowGain: 0, midGain: 0, highGain: 0, enabled: false };
  const reverb = effects.reverb || { mix: 0, enabled: false };

  const handleEqChange = (band, value) => {
    updateTrackEffect(selectedTrackId, 'eq', {
      ...eq,
      [`${band}Gain`]: value,
      enabled: true
    });
  };

  const handleReverbChange = (value) => {
    updateTrackEffect(selectedTrackId, 'reverb', {
      ...reverb,
      mix: value,
      enabled: true
    });
  };

  if (!track) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xs">
        <div className="text-center">
          <Sliders className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Select a track to apply DSP controls</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-panel rounded-3xl p-8 w-full max-w-5xl mx-auto flex flex-col gap-8 mt-8"
    >
      <div className="flex items-center gap-3 mb-2 px-2 border-b border-white/10 pb-6">
        <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
          <Sliders className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Studio DSP Controls</h2>
          <p className="text-gray-400 text-sm mt-1">Fine-tune the mix with Cubase-style processing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Equalizer Section */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">Equalizer (EQ)</h3>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-500 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border border-white/10">
                EQ allows you to adjust the volume of specific frequency ranges to balance the mix.
              </div>
            </div>
          </div>
          
          <div className="space-y-6 bg-black/30 p-6 rounded-2xl border border-white/5">
            {/* Low EQ */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-300 font-medium">Low (Bass/Sub)</span>
                <span className="text-blue-400 font-mono">{eq.lowGain > 0 ? '+' : ''}{eq.lowGain} dB</span>
              </div>
              <input 
                type="range" 
                min="-12" max="12" step="0.1" 
                value={eq.lowGain} 
                onChange={(e) => handleEqChange('low', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-blue-300 mt-1 h-8">
                {eq.lowGain === 0 && <span className="text-gray-500">Neutral bass balance.</span>}
                {eq.lowGain > 0 && "Boosting bass adds weight and punch, but too much causes muddiness."}
                {eq.lowGain < 0 && "Cutting bass removes rumble and mud, but too much makes the mix thin."}
              </p>
            </div>

            {/* Mid EQ */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-300 font-medium">Mid (Vocals/Instruments)</span>
                <span className="text-blue-400 font-mono">{eq.midGain > 0 ? '+' : ''}{eq.midGain} dB</span>
              </div>
              <input 
                type="range" 
                min="-12" max="12" step="0.1" 
                value={eq.midGain} 
                onChange={(e) => handleEqChange('mid', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-blue-300 mt-1 h-8">
                {eq.midGain === 0 && <span className="text-gray-500">Neutral vocal/instrument presence.</span>}
                {eq.midGain > 0 && "Boosting mids adds presence, but too much sounds harsh or 'honky'."}
                {eq.midGain < 0 && "Cutting mids removes harshness, but too much hollows out the track."}
              </p>
            </div>

            {/* High EQ */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-300 font-medium">High (Air/Treble)</span>
                <span className="text-blue-400 font-mono">{eq.highGain > 0 ? '+' : ''}{eq.highGain} dB</span>
              </div>
              <input 
                type="range" 
                min="-12" max="12" step="0.1" 
                value={eq.highGain} 
                onChange={(e) => handleEqChange('high', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-xs text-blue-300 mt-1 h-8">
                {eq.highGain === 0 && <span className="text-gray-500">Neutral treble/air balance.</span>}
                {eq.highGain > 0 && "Boosting highs adds sparkle and air, but too much causes piercing sibilance."}
                {eq.highGain < 0 && "Cutting highs removes piercing sounds, but too much makes it dull."}
              </p>
            </div>
          </div>
        </div>

        {/* Reverb Section */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">Reverb</h3>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-500 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl border border-white/10">
                Reverb simulates acoustic spaces (like a hall or room) to add depth to the mix.
              </div>
            </div>
          </div>

          <div className="space-y-6 bg-black/30 p-6 rounded-2xl border border-white/5 h-full flex flex-col justify-center">
            
            <div className="flex items-center justify-center mb-4">
              <div className="p-6 bg-violet-500/10 rounded-full border border-violet-500/20 relative">
                 <Waves className="w-12 h-12 text-violet-400" />
                 {/* Visual indicator of reverb amount */}
                 <div 
                   className="absolute inset-0 border-2 border-violet-500/40 rounded-full animate-ping"
                   style={{ animationDuration: `${3 - (reverb.mix / 100) * 2}s`, opacity: reverb.mix / 100 }}
                 />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-300 font-medium">Wet / Dry Mix</span>
                <span className="text-violet-400 font-mono">{reverb.mix}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" step="1" 
                value={reverb.mix} 
                onChange={(e) => handleReverbChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <p className="text-xs text-violet-300 text-center mt-2 h-8">
                {reverb.mix === 0 && <span className="text-gray-500">Dry signal. Sounds very close and in-your-face.</span>}
                {reverb.mix > 0 && reverb.mix <= 30 && "Subtle ambiance. Adds natural depth without muddying."}
                {reverb.mix > 30 && reverb.mix <= 60 && "Noticeable space. Good for creating a distinct room feel."}
                {reverb.mix > 60 && "Heavy wash. Pushes the sound far back, can easily become muddy."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DSPControls;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Sliders, Zap, Wind, Disc, ArrowDown, ChevronDown, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const MODULE_ICONS = {
  eq: <Sliders className="w-3.5 h-3.5 text-rose-400" />,
  compressor: <Zap className="w-3.5 h-3.5 text-yellow-400" />,
  deEsser: <Wind className="w-3.5 h-3.5 text-cyan-400" />,
  saturation: <Disc className="w-3.5 h-3.5 text-orange-400" />,
};

const MODULE_LABELS = {
  eq: 'Parametric EQ',
  compressor: 'Compressor',
  deEsser: 'De-Esser',
  saturation: 'Saturator',
};

const MODULE_COLORS = {
  eq: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/10' },
  compressor: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/10' },
  deEsser: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
  saturation: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/10' },
};

const Slider = ({ value, min, max, step, onChange, label, unit, color = 'cyan' }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex justify-between text-[9px] text-gray-400 font-mono">
      <span>{label}</span>
      <span className={`text-${color}-400`}>{value}{unit}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`w-full h-1 bg-[#333] rounded appearance-none cursor-pointer accent-${color}-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full`}
    />
  </div>
);

const ChannelStrip = ({ selectedTrackId }) => {
  const { tracks, updateTrackEffect, channelStripPresets, applyChannelStripPreset } = useAudioContext();
  const [selectedPreset, setSelectedPreset] = useState('');

  const track = tracks.find(t => t.id === selectedTrackId);

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
        <Layers className="w-10 h-10 mb-3 opacity-30" />
        <h3 className="text-sm font-bold text-gray-400 mb-1">Channel Strip</h3>
        <p className="text-xs">Select a track to view its signal chain</p>
      </div>
    );
  }

  const { effects } = track;
  const update = (key, updates) => updateTrackEffect(track.id, key, updates);

  const signalChain = ['eq', 'compressor', 'deEsser', 'saturation'];

  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    if (presetName && applyChannelStripPreset) {
      applyChannelStripPreset(track.id, presetName);
    }
  };

  const activeCount = signalChain.filter(key => effects?.[key]?.enabled).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#161616] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">Channel Strip</span>
          <span className="text-[10px] text-gray-500 font-mono">— {track.name}</span>
          <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] text-amber-300 font-bold">
            {activeCount}/{signalChain.length} Active
          </span>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="bg-[#111] border border-[#333] rounded text-[10px] text-gray-200 px-2 py-1 outline-none focus:border-violet-500 cursor-pointer"
          >
            <option value="">Load Preset...</option>
            {channelStripPresets && Object.keys(channelStripPresets).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Signal Flow Visualization */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {/* Input Label */}
          <div className="flex items-center justify-center mb-3">
            <div className="px-4 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-full text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              ⬤ Input Signal
            </div>
          </div>

          {/* Signal Chain Modules */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch">
            {signalChain.map((moduleKey, idx) => {
              const moduleEffects = effects?.[moduleKey];
              const isEnabled = moduleEffects?.enabled;
              const colors = MODULE_COLORS[moduleKey];

              return (
                <React.Fragment key={moduleKey}>
                  {/* Connector Arrow (between modules) */}
                  {idx > 0 && (
                    <div className="hidden lg:flex items-center justify-center flex-shrink-0">
                      <div className={`w-6 h-0.5 ${isEnabled ? 'bg-cyan-500/50' : 'bg-[#333]'} transition-colors`} />
                      <ArrowDown className={`w-3 h-3 rotate-[-90deg] ${isEnabled ? 'text-cyan-500/50' : 'text-[#333]'} -ml-1 transition-colors`} />
                    </div>
                  )}
                  {idx > 0 && (
                    <div className="lg:hidden flex items-center justify-center flex-shrink-0">
                      <div className={`w-0.5 h-4 ${isEnabled ? 'bg-cyan-500/50' : 'bg-[#333]'} transition-colors`} />
                    </div>
                  )}

                  {/* Module Card */}
                  <motion.div
                    layout
                    className={`flex-1 min-w-0 rounded-lg border p-3 transition-all ${
                      isEnabled
                        ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                        : 'bg-[#111] border-[#2a2a2a] opacity-60'
                    }`}
                  >
                    {/* Module Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {MODULE_ICONS[moduleKey]}
                        <span className={`text-[10px] font-bold ${isEnabled ? colors.text : 'text-gray-500'}`}>
                          {MODULE_LABELS[moduleKey]}
                        </span>
                      </div>
                      <button
                        onClick={() => update(moduleKey, { enabled: !isEnabled })}
                        className="transition-transform hover:scale-110"
                      >
                        {isEnabled
                          ? <ToggleRight className="w-5 h-5 text-cyan-400" />
                          : <ToggleLeft className="w-5 h-5 text-gray-600" />
                        }
                      </button>
                    </div>

                    {/* Module Controls */}
                    {isEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 mt-2"
                      >
                        {moduleKey === 'eq' && (
                          <div className="space-y-1.5">
                            {moduleEffects.bands?.map((band, i) => (
                              <div key={band.id || i} className="flex items-center gap-2">
                                <span className="text-[8px] text-gray-500 w-10 font-mono">{band.type === 'highpass' ? 'HP' : band.type === 'highshelf' ? 'HS' : `${Math.round(band.freq)}Hz`}</span>
                                <input
                                  type="range" min={-12} max={12} step={0.5}
                                  value={band.gain}
                                  onChange={(e) => {
                                    const newBands = [...moduleEffects.bands];
                                    newBands[i] = { ...newBands[i], gain: parseFloat(e.target.value) };
                                    update('eq', { bands: newBands });
                                  }}
                                  className="flex-1 h-1 bg-[#333] rounded appearance-none cursor-pointer accent-rose-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                />
                                <span className="text-[8px] text-rose-400 w-10 text-right font-mono">
                                  {band.gain > 0 ? '+' : ''}{band.gain}dB
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {moduleKey === 'compressor' && (
                          <div className="space-y-1.5">
                            <Slider label="Threshold" value={moduleEffects.threshold} min={-40} max={0} step={0.5} unit="dB" color="yellow" onChange={(val) => update('compressor', { threshold: val })} />
                            <Slider label="Ratio" value={moduleEffects.ratio} min={1} max={10} step={0.1} unit=":1" color="yellow" onChange={(val) => update('compressor', { ratio: val })} />
                            {/* Visual gain reduction meter */}
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[8px] text-gray-500 font-mono">GR</span>
                              <div className="flex-1 h-1.5 bg-[#222] rounded overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded"
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${Math.min(100, Math.abs(moduleEffects.threshold) * (moduleEffects.ratio / 10) * 5)}%` }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                              <span className="text-[8px] text-yellow-400 font-mono">
                                -{Math.abs(moduleEffects.threshold * (1 - 1 / moduleEffects.ratio) * 0.4).toFixed(1)}dB
                              </span>
                            </div>
                          </div>
                        )}

                        {moduleKey === 'deEsser' && (
                          <Slider label="Amount" value={moduleEffects.amount} min={0} max={100} step={1} unit="%" color="cyan" onChange={(val) => update('deEsser', { amount: val })} />
                        )}

                        {moduleKey === 'saturation' && (
                          <Slider label="Drive" value={moduleEffects.drive} min={0} max={100} step={1} unit="%" color="orange" onChange={(val) => update('saturation', { drive: val })} />
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Output Label */}
          <div className="flex items-center justify-center mt-3">
            <div className="hidden lg:flex items-center">
              <div className={`w-0.5 h-0 lg:w-6 lg:h-0.5 ${activeCount > 0 ? 'bg-emerald-500/50' : 'bg-[#333]'}`} />
            </div>
            <div className="lg:hidden flex items-center justify-center">
              <div className={`w-0.5 h-4 ${activeCount > 0 ? 'bg-emerald-500/50' : 'bg-[#333]'}`} />
            </div>
          </div>
          <div className="flex items-center justify-center mt-1">
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              activeCount > 0
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-[#1a1a1a] border border-[#333] text-gray-500'
            }`}>
              ⬤ Output Signal — {activeCount > 0 ? `${activeCount} modules active` : 'Bypass (no processing)'}
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-4 bg-[#111] border border-[#2a2a2a] rounded-lg p-3 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-300 font-bold">Real DSP Processing</p>
              <p className="text-[9px] text-gray-500 mt-0.5">
                These effects are applied as real audio processing (biquad EQ, dynamic compression, frequency-targeted de-essing, tanh saturation) during mixing. Click "XAI Mix" to hear the results with Channel Strip processing applied.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelStrip;

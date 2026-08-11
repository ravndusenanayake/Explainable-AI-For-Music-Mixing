import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Power } from 'lucide-react';
import { motion } from 'framer-motion';

// Global audio context for frequency response math
const getAudioCtx = () => {
  if (!window._eqAudioCtx) {
    window._eqAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return window._eqAudioCtx;
};

// Convert frequency to X pixel (logarithmic)
const freqToX = (freq, width) => {
  const minF = Math.log10(20);
  const maxF = Math.log10(20000);
  const curr = Math.log10(Math.max(20, Math.min(20000, freq)));
  return ((curr - minF) / (maxF - minF)) * width;
};

// Convert X pixel to frequency
const xToFreq = (x, width) => {
  const minF = Math.log10(20);
  const maxF = Math.log10(20000);
  const norm = x / width;
  return Math.pow(10, minF + norm * (maxF - minF));
};

// Convert dB to Y pixel
const dbToY = (db, height) => {
  const maxDb = 18;
  const clampedDb = Math.max(-maxDb, Math.min(maxDb, db));
  return ((maxDb - clampedDb) / (maxDb * 2)) * height;
};

// Convert Y pixel to dB
const yToDb = (y, height) => {
  const maxDb = 18;
  const norm = y / height;
  return maxDb - (norm * maxDb * 2);
};

const InteractiveEQ = ({ track, onClose, onUpdate, pushUndo }) => {
  const [width, setWidth] = useState(800);
  const height = 400;
  const containerRef = useRef(null);

  // Initialize bands safely if old state is present
  const defaultBands = [
    { id: 1, type: 'highpass', freq: 80, gain: 0, q: 1 },
    { id: 2, type: 'peaking', freq: 500, gain: 0, q: 1 },
    { id: 3, type: 'peaking', freq: 2000, gain: 0, q: 1 },
    { id: 4, type: 'highshelf', freq: 8000, gain: 0, q: 1 }
  ];
  
  const bands = track.effects?.eq?.bands || defaultBands;
  const isEnabled = track.effects?.eq?.enabled || false;

  const [activeNode, setActiveNode] = useState(null);
  const [curvePath, setCurvePath] = useState('');
  const [filledPath, setFilledPath] = useState('');

  // Generate Frequency Array for X-axis resolution
  const freqs = useMemo(() => {
    const f = new Float32Array(width);
    for (let i = 0; i < width; i++) {
      f[i] = xToFreq(i, width);
    }
    return f;
  }, [width]);

  // Calculate Frequency Response Curve using Web Audio API
  useEffect(() => {
    if (!freqs.length) return;
    
    const ctx = getAudioCtx();
    const totalDb = new Float32Array(width);

    // Create filters and get their response
    bands.forEach(band => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.freq;
      filter.gain.value = band.gain;
      filter.Q.value = band.q;

      const magResponse = new Float32Array(width);
      const phaseResponse = new Float32Array(width);
      filter.getFrequencyResponse(freqs, magResponse, phaseResponse);

      for (let i = 0; i < width; i++) {
        totalDb[i] += 20 * Math.log10(magResponse[i]);
      }
    });

    // Generate SVG path
    let path = `M 0 ${dbToY(totalDb[0], height)}`;
    for (let i = 1; i < width; i++) {
      path += ` L ${i} ${dbToY(totalDb[i], height)}`;
    }
    
    setCurvePath(path);
    setFilledPath(`${path} L ${width} ${height} L 0 ${height} Z`);
    
  }, [bands, freqs, height, width]);

  // Handle Resize
  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.clientWidth);
    }
    const handleResize = () => {
      if (containerRef.current) setWidth(containerRef.current.clientWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Node Dragging Logic
  const handlePointerDown = (e, bandId) => {
    if (pushUndo) pushUndo();
    e.stopPropagation();
    setActiveNode(bandId);
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!activeNode || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(height, e.clientY - rect.top));
      
      const newFreq = xToFreq(x, width);
      const newGain = yToDb(y, height);

      const newBands = bands.map(b => 
        b.id === activeNode 
          ? { ...b, freq: newFreq, gain: b.type === 'highpass' || b.type === 'lowpass' ? b.gain : newGain } 
          : b
      );
      onUpdate('eq', { bands: newBands });
    };

    const handlePointerUp = () => setActiveNode(null);

    if (activeNode) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeNode, bands, width, height, onUpdate]);

  // Scroll to change Q factor
  const handleWheel = (e, bandId) => {
    e.preventDefault();
    if (pushUndo) pushUndo();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newBands = bands.map(b => {
      if (b.id === bandId) {
        return { ...b, q: Math.max(0.1, Math.min(20, b.q + delta)) };
      }
      return b;
    });
    onUpdate('eq', { bands: newBands });
  };

  const handleBandChange = (bandId, key, val) => {
    if (pushUndo) pushUndo();
    const newBands = bands.map(b => b.id === bandId ? { ...b, [key]: val } : b);
    onUpdate('eq', { bands: newBands });
  };

  // Draw Grid Lines
  const gridFrequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const gridDbs = [-12, -6, 0, 6, 12];

  const bandColors = ['#fda4af', '#fcd34d', '#5eead4', '#93c5fd'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-5xl bg-[#111] border border-[#333] rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h2 className="text-gray-200 font-bold text-sm tracking-wide">{track.name} - Parametric EQ</h2>
            <button 
              onClick={() => { if (pushUndo) pushUndo(); onUpdate('eq', { enabled: !isEnabled }); }}
              className={`w-10 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-cyan-500' : 'bg-gray-600'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${isEnabled ? 'left-5.5 right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Graph Area */}
        <div 
          ref={containerRef} 
          className="relative w-full bg-[#0a0a0a] cursor-crosshair overflow-hidden touch-none"
          style={{ height: height }}
        >
          {/* Static Background Grid */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Horizontal dB Lines */}
            {gridDbs.map(db => {
              const y = dbToY(db, height);
              return (
                <g key={db}>
                  <line x1="0" y1={y} x2={width} y2={y} stroke="#222" strokeWidth="1" />
                  <text x="5" y={y - 4} fill="#555" fontSize="10">{db > 0 ? `+${db}` : db} dB</text>
                </g>
              );
            })}
            
            {/* Vertical Frequency Lines */}
            {gridFrequencies.map(freq => {
              const x = freqToX(freq, width);
              return (
                <g key={freq}>
                  <line x1={x} y1="0" x2={x} y2={height} stroke="#222" strokeWidth="1" />
                  <text x={x + 4} y={height - 6} fill="#555" fontSize="10">
                    {freq >= 1000 ? `${freq/1000}k` : freq}Hz
                  </text>
                </g>
              );
            })}

            {/* Zero dB Line */}
            <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#444" strokeWidth="1.5" />
            
            {/* Frequency Response Curve */}
            {isEnabled && (
              <>
                <path d={filledPath} fill="url(#eq-gradient)" opacity="0.3" />
                <path d={curvePath} fill="none" stroke="#fff" strokeWidth="2.5" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
              </>
            )}

            <defs>
              <linearGradient id="eq-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Interactive Nodes */}
          {isEnabled && bands.map((band, i) => {
            const x = freqToX(band.freq, width);
            const y = dbToY(band.gain, height);
            return (
              <div
                key={band.id}
                className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                style={{ 
                  left: x, 
                  top: band.type === 'highpass' || band.type === 'lowpass' ? height/2 : y,
                  backgroundColor: bandColors[i] 
                }}
                onPointerDown={(e) => handlePointerDown(e, band.id)}
                onWheel={(e) => handleWheel(e, band.id)}
              >
                <span className="text-[10px] font-bold text-black">{band.id}</span>
              </div>
            );
          })}
        </div>

        {/* Lower Controls Panel */}
        <div className="bg-[#151515] p-4 flex justify-between gap-4 border-t border-[#2a2a2a]">
          {bands.map((band, i) => (
            <div key={band.id} className="flex-1 bg-[#1a1a1a] rounded-lg p-3 border border-[#333]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bandColors[i] }} />
                  <span className="text-xs font-bold text-gray-300">BAND {band.id}</span>
                </div>
                <select 
                  value={band.type}
                  onChange={(e) => handleBandChange(band.id, 'type', e.target.value)}
                  className="bg-[#111] border border-[#444] rounded text-[10px] text-gray-300 p-1 outline-none"
                >
                  <option value="highpass">High-Pass</option>
                  <option value="lowshelf">Low-Shelf</option>
                  <option value="peaking">Peaking</option>
                  <option value="highshelf">High-Shelf</option>
                  <option value="lowpass">Low-Pass</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 mb-1">FREQ</span>
                  <input 
                    type="number" value={Math.round(band.freq)} 
                    onChange={(e) => handleBandChange(band.id, 'freq', parseFloat(e.target.value) || 20)}
                    className="w-full bg-[#111] border border-[#333] rounded text-center text-xs text-white p-1"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 mb-1">GAIN</span>
                  <input 
                    type="number" value={band.gain.toFixed(1)} 
                    disabled={band.type === 'highpass' || band.type === 'lowpass'}
                    onChange={(e) => handleBandChange(band.id, 'gain', parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#111] border border-[#333] rounded text-center text-xs text-white p-1 disabled:opacity-30"
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-gray-500 mb-1">Q</span>
                  <input 
                    type="number" value={band.q.toFixed(2)} step="0.1"
                    onChange={(e) => handleBandChange(band.id, 'q', parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#111] border border-[#333] rounded text-center text-xs text-white p-1"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default InteractiveEQ;

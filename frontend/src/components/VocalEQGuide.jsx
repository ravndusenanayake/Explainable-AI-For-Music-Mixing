import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Waves, Sparkles, ShieldCheck, Info, Power, Music, AudioLines } from 'lucide-react';

// Utility for logarithmic scale mapping (Cut Filter)
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const minLog = Math.log10(MIN_FREQ);
const maxLog = Math.log10(MAX_FREQ);
const logRange = maxLog - minLog;

const freqToX = (freq) => ((Math.log10(Math.max(MIN_FREQ, Math.min(freq, MAX_FREQ))) - minLog) / logRange) * 100;
const xToFreq = (x) => Math.pow(10, minLog + (x / 100) * logRange);
const formatFreq = (f) => f >= 1000 ? `${(f/1000).toFixed(1)}k` : Math.round(f);

const CLEAN_MODULES = ['CUT FILTER', 'GATE', 'PITCH', 'DE-ESSER I', 'DYN FILTER I', 'COMPRESSOR I', 'EQ I'];
const CHARACTER_MODULES = ['EXCITER', 'SATURATOR', 'COMPRESSOR II'];

const VocalEQGuide = ({ eqSettings, onEqChange }) => {
  const { lcFreq, hcFreq, enabledModules } = eqSettings;

  const [activeModule, setActiveModule] = useState('CUT FILTER');
  
  // Internal UI states for other mock modules
  const [gateThreshold, setGateThreshold] = useState(30); // 0-100
  const [pitchSpeed, setPitchSpeed] = useState(60); // 0-100
  const [genericAmount, setGenericAmount] = useState(50); // 0-100

  
  const containerRef = useRef(null);

  const toggleModule = (mod) => {
    const next = new Set(enabledModules);
    if (next.has(mod)) next.delete(mod);
    else next.add(mod);
    onEqChange({ ...eqSettings, enabledModules: next });
  };

  // Drag handlers
  const handleDragLC = (e, info) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPercent = ((info.point.x - rect.left) / rect.width) * 100;
    onEqChange({ ...eqSettings, lcFreq: Math.max(MIN_FREQ, Math.min(xToFreq(xPercent), hcFreq - 100)) });
  };

  const handleDragHC = (e, info) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPercent = ((info.point.x - rect.left) / rect.width) * 100;
    onEqChange({ ...eqSettings, hcFreq: Math.min(MAX_FREQ, Math.max(xToFreq(xPercent), lcFreq + 100)) });
  };

  const handleDragVertical = (e, info, setter) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Invert Y so 0 is bottom, 100 is top
    let yPercent = 100 - (((info.point.y - rect.top) / rect.height) * 100);
    setter(Math.max(0, Math.min(100, yPercent)));
  };

  const handleDragHorizontal = (e, info, setter) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let xPercent = ((info.point.x - rect.left) / rect.width) * 100;
    setter(Math.max(0, Math.min(100, xPercent)));
  };

  // Feedback Logic
  const getFeedback = () => {
    switch (activeModule) {
      case 'CUT FILTER':
        return {
          title: 'Cut Filters (LC / HC)',
          icon: <ShieldCheck className="w-5 h-5 text-pink-400" />,
          items: [
            {
              name: 'Low Cut',
              value: `${formatFreq(lcFreq)}Hz`,
              color: 'text-pink-400',
              text: lcFreq < 30 ? 'Sub-rumble might still be present. Try raising to ~50Hz.' :
                    lcFreq <= 80 ? 'Perfect clean cut. Removes rumble without thinning body.' :
                    lcFreq <= 150 ? 'Aggressive cut. Good if vocal is boomy, but might thin it.' :
                    'Warning: This will significantly thin out the vocal tone.'
            },
            {
              name: 'High Cut',
              value: `${formatFreq(hcFreq)}Hz`,
              color: 'text-violet-400',
              text: hcFreq > 18500 ? 'Extreme highs might still have digital harshness/hiss.' :
                    hcFreq >= 15000 ? 'Perfect air band. Removes hiss but keeps breathy clarity.' :
                    hcFreq >= 10000 ? 'Warm, vintage tone. Reduces modern brightness.' :
                    'Warning: This will severely muffle the vocal, losing clarity.'
            }
          ]
        };
      case 'GATE':
        return {
          title: 'Noise Gate',
          icon: <AudioLines className="w-5 h-5 text-blue-400" />,
          items: [
            {
              name: 'Threshold',
              value: `${gateThreshold.toFixed(0)}%`,
              color: 'text-blue-400',
              text: gateThreshold < 20 ? 'Threshold very low. Background noise (headphones bleed, AC) will still be heard.' :
                    gateThreshold <= 50 ? 'Optimal setting. Silences room noise and breaths between phrases smoothly.' :
                    'Warning: Threshold too high! Quiet vocal phrases will be abruptly cut off.'
            }
          ]
        };
      case 'PITCH':
        return {
          title: 'Pitch Correction',
          icon: <Music className="w-5 h-5 text-green-400" />,
          items: [
            {
              name: 'Retune Speed',
              value: `${pitchSpeed.toFixed(0)}%`,
              color: 'text-green-400',
              text: pitchSpeed < 20 ? 'Fast retune speed. Creates a robotic, hard-tuned effect (T-Pain/Travis Scott style).' :
                    pitchSpeed <= 70 ? 'Moderate speed. Transparently corrects minor pitch drifts while sounding natural.' :
                    'Slow retune. Very natural, preserves all vocal slides and vibrato, but might leave some flat notes.'
            }
          ]
        };
      default:
        return {
          title: `${activeModule} Processing`,
          icon: <Sparkles className="w-5 h-5 text-yellow-400" />,
          items: [
            {
              name: 'Amount',
              value: `${genericAmount.toFixed(0)}%`,
              color: 'text-yellow-400',
              text: genericAmount < 30 ? `Subtle ${activeModule.toLowerCase()} applied. Good for transparent mixing.` :
                    genericAmount <= 70 ? `Noticeable ${activeModule.toLowerCase()} character. Adds standard polish and weight.` :
                    `Aggressive ${activeModule.toLowerCase()}. Can sound over-processed if not careful.`
            }
          ]
        };
    }
  };

  const feedback = getFeedback();

  // Rendering graphs based on active module
  const renderGraph = () => {
    if (activeModule === 'CUT FILTER') {
      const lcX = freqToX(lcFreq);
      const hcX = freqToX(hcFreq);
      return (
        <>
          <svg className="w-full h-full absolute inset-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d={`M 0,100 C ${Math.max(0, lcX - 5)},100 ${Math.max(0, lcX - 2)},50 ${lcX},50 L ${hcX},50 C ${Math.min(100, hcX + 2)},50 ${Math.min(100, hcX + 5)},100 100,100`} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="0.8"/>
            <path d={`M 0,100 C ${Math.max(0, lcX - 5)},100 ${Math.max(0, lcX - 2)},50 ${lcX},50 L ${hcX},50 C ${Math.min(100, hcX + 2)},50 ${Math.min(100, hcX + 5)},100 100,100 L 100,100 L 0,100 Z`} fill="rgba(255,255,255,0.05)"/>
          </svg>
          <motion.div drag="x" dragConstraints={containerRef} dragElastic={0} dragMomentum={false} onDrag={handleDragLC} className="absolute top-[48%] -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20" style={{ left: `${lcX}%`, x: '-50%' }}>
            <div className="bg-[#b3a85b] text-black text-[10px] font-bold px-1.5 py-0.5 rounded mb-2">{formatFreq(lcFreq)}</div>
            <div className="w-4 h-4 rounded-full bg-[#b3a85b] border-2 border-white shadow-[0_0_15px_rgba(179,168,91,0.8)] hover:scale-125 transition-transform"></div>
          </motion.div>
          <motion.div drag="x" dragConstraints={containerRef} dragElastic={0} dragMomentum={false} onDrag={handleDragHC} className="absolute top-[48%] -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20" style={{ left: `${hcX}%`, x: '-50%' }}>
            <div className="bg-[#b3a85b] text-black text-[10px] font-bold px-1.5 py-0.5 rounded mb-2">{formatFreq(hcFreq)}</div>
            <div className="w-4 h-4 rounded-full bg-[#b3a85b] border-2 border-white shadow-[0_0_15px_rgba(179,168,91,0.8)] hover:scale-125 transition-transform"></div>
          </motion.div>
          <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[8px] text-gray-500 font-mono pointer-events-none">
            <span>20</span><span>50</span><span>100</span><span>500</span><span>1k</span><span>5k</span><span>10k</span><span>20k</span>
          </div>
        </>
      );
    }

    if (activeModule === 'GATE') {
      return (
        <>
          <svg className="w-full h-full absolute inset-0 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* Fake Waveform */}
            <path d="M 0,50 Q 5,20 10,50 T 20,50 T 30,50 Q 35,10 40,50 T 50,50 Q 55,30 60,50 T 70,50 T 80,50 Q 85,15 90,50 T 100,50" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1"/>
            <path d="M 0,50 Q 5,80 10,50 T 20,50 T 30,50 Q 35,90 40,50 T 50,50 Q 55,70 60,50 T 70,50 T 80,50 Q 85,85 90,50 T 100,50" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="1"/>
            
            {/* Threshold Line */}
            <line x1="0" y1={100 - gateThreshold} x2="100" y2={100 - gateThreshold} stroke="rgba(255,255,255,0.8)" strokeWidth="0.5" strokeDasharray="2 2" />
            
            {/* Shaded area below threshold */}
            <rect x="0" y={100 - gateThreshold} width="100" height={gateThreshold} fill="rgba(239,68,68,0.1)" />
          </svg>
          <motion.div drag="y" dragConstraints={containerRef} dragElastic={0} dragMomentum={false} onDrag={(e,i) => handleDragVertical(e,i,setGateThreshold)} className="absolute left-1/2 -translate-x-1/2 flex flex-row items-center cursor-grab active:cursor-grabbing z-20 gap-2" style={{ top: `${100 - gateThreshold}%`, y: '-50%' }}>
            <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] hover:scale-125 transition-transform"></div>
            <div className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">Thresh</div>
          </motion.div>
        </>
      );
    }

    if (activeModule === 'PITCH') {
      // Speed 0 = steps (hard), 100 = smooth sine
      const smoothness = pitchSpeed / 100;
      return (
        <>
          <svg className="w-full h-full absolute inset-0 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* Background notes grid */}
            {[20,40,60,80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />)}
            
            {/* Original Pitch (Grey) */}
            <path d="M 0,50 Q 25,10 50,50 T 100,50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 2" />
            
            {/* Corrected Pitch */}
            <path d={`M 0,50 C ${25 * smoothness},${50 - (40 * (1-smoothness))} ${25 * (1+smoothness)},${10 + (40 * smoothness)} 50,50 C ${75 * smoothness},${50 + (40 * (1-smoothness))} ${75 * (1+smoothness)},${90 - (40 * smoothness)} 100,50`} fill="none" stroke="rgba(74,222,128,0.8)" strokeWidth="1.5" className="drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]"/>
          </svg>
          <motion.div drag="x" dragConstraints={containerRef} dragElastic={0} dragMomentum={false} onDrag={(e,i) => handleDragHorizontal(e,i,setPitchSpeed)} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20" style={{ left: `${pitchSpeed}%`, x: '-50%' }}>
            <div className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded mb-2 shadow-lg">Speed: {pitchSpeed.toFixed(0)}</div>
            <div className="w-4 h-4 rounded-full bg-green-400 border-2 border-white shadow-[0_0_15px_rgba(74,222,128,0.8)] hover:scale-125 transition-transform"></div>
          </motion.div>
        </>
      );
    }

    // Generic Graph for others
    return (
      <>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <Sparkles className="w-32 h-32 text-yellow-400" />
        </div>
        <svg className="w-full h-full absolute inset-0 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={genericAmount / 2} fill="rgba(250,204,21,0.1)" stroke="rgba(250,204,21,0.5)" strokeWidth="1" />
        </svg>
        <motion.div drag="x" dragConstraints={containerRef} dragElastic={0} dragMomentum={false} onDrag={(e,i) => handleDragHorizontal(e,i,setGenericAmount)} className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20" style={{ left: `${genericAmount}%`, x: '-50%' }}>
          <div className="bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded mb-2 shadow-lg">Amount: {genericAmount.toFixed(0)}</div>
          <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-white shadow-[0_0_15px_rgba(250,204,21,0.8)] hover:scale-125 transition-transform"></div>
        </motion.div>
      </>
    );
  };

  const SidebarItem = ({ name }) => {
    const isActive = activeModule === name;
    const isEnabled = enabledModules.has(name);
    return (
      <div 
        onClick={() => setActiveModule(name)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}
      >
        <div 
          onClick={(e) => { e.stopPropagation(); toggleModule(name); }}
          className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-colors ${isEnabled ? 'bg-blue-400 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'border-gray-600 hover:border-gray-400'}`}
        />
        <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-400'}`}>{name}</span>
        <span className={`ml-auto text-[10px] ${isEnabled ? 'text-blue-300' : 'text-gray-600'}`}>{isEnabled ? 'ON' : 'OFF'}</span>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-full max-w-5xl mx-auto mt-12 mb-8"
    >
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="p-2 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-xl border border-white/10 shadow-lg">
          <Mic className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Interactive Vocal Processing</h2>
          <p className="text-gray-400 text-sm mt-1">Select a module from the sidebar, toggle it, and adjust parameters.</p>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-8 border border-white/10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          <div className="lg:col-span-7 bg-[#1a1c23] rounded-2xl border border-white/5 overflow-hidden shadow-2xl flex flex-col md:flex-row">
            
            {/* Sidebar */}
            <div className="w-full md:w-48 bg-[#13151a] border-r border-white/5 p-4 flex flex-col gap-6 overflow-y-auto max-h-[400px]">
              <div>
                <div className="bg-[#b3a85b] text-black text-xs font-bold px-3 py-1.5 rounded mb-4 text-center">OVERVIEW</div>
                <div className="mb-2 text-[10px] font-bold text-gray-500 tracking-wider">CLEAN</div>
                <div className="flex flex-col gap-1">
                  {CLEAN_MODULES.map(mod => <SidebarItem key={mod} name={mod} />)}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-bold text-gray-500 tracking-wider">CHARACTER</div>
                <div className="flex flex-col gap-1">
                  {CHARACTER_MODULES.map(mod => <SidebarItem key={mod} name={mod} />)}
                </div>
              </div>
            </div>

            {/* Visualizer Panel */}
            <div className="flex-1 p-6 relative min-h-[300px] bg-[#1a1c23] select-none" ref={containerRef}>
              {!enabledModules.has(activeModule) && (
                <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="bg-gray-800/80 px-4 py-2 rounded-full border border-white/10 text-gray-300 text-sm font-medium flex items-center gap-2">
                    <Power className="w-4 h-4" /> Module Bypassed
                  </div>
                </div>
              )}
              
              <div className="absolute inset-4 border border-white/5 rounded pointer-events-none" style={{
                backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`,
                backgroundSize: '12.5% 10%'
              }}></div>
              
              {renderGraph()}
            </div>
          </div>

          {/* Dynamic AI Explanation Content */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            <div className="bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20 shadow-lg relative overflow-hidden flex-1">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Info className="w-32 h-32" /></div>
              <div className="flex items-center gap-3 mb-6 relative z-10">
                {feedback.icon}
                <h3 className="text-xl font-bold text-blue-100">{feedback.title}</h3>
              </div>
              
              <div className="space-y-4 relative z-10">
                {feedback.items.map((item, idx) => (
                  <div key={idx} className="bg-black/40 rounded-xl p-4 border border-white/5 transition-all hover:border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-white">{item.name}</span>
                      <span className={`${item.color} font-mono text-sm bg-white/5 px-2 py-1 rounded`}>{item.value}</span>
                    </div>
                    <p className={`text-sm ${
                      item.text.includes('Warning') ? 'text-red-400' :
                      item.text.includes('Perfect') || item.text.includes('Optimal') ? 'text-green-300' :
                      item.text.includes('robotic') || item.text.includes('Sub-rumble') ? 'text-yellow-300' :
                      'text-blue-200'
                    }`}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
              <h4 className="font-semibold text-gray-200 text-sm mb-2">Interaction Guide:</h4>
              <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
                <li>Click a module name on the left to view its controls.</li>
                <li>Click the circular icon next to a module to turn it ON/OFF.</li>
                <li>Drag the illuminated points in the graph to adjust settings and receive real-time AI feedback.</li>
              </ul>
            </div>

          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default VocalEQGuide;

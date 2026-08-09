import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, SkipBack, Volume2, Mic, Guitar, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const WaveformLayer = ({ audioUrl, label, icon: Icon, color, isActive, onReady, syncRef, onTimeUpdate }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color.wave,
      progressColor: color.progress,
      cursorColor: 'rgba(255,255,255,0.5)',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 60,
      normalize: true,
      fillParent: true,
      interact: true,
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
      if (onReady) onReady(ws);
    });

    ws.on('timeupdate', (currentTime) => {
      if (onTimeUpdate) onTimeUpdate(currentTime);
    });

    ws.load(audioUrl);

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl]);

  // Expose wavesurfer ref to parent
  useEffect(() => {
    if (syncRef) {
      syncRef.current = wavesurferRef.current;
    }
  });

  return (
    <div className={`relative rounded-xl border transition-all duration-300 ${
      isActive 
        ? `border-white/10 bg-black/40 shadow-lg` 
        : 'border-white/5 bg-black/20 opacity-60'
    }`}>
      {/* Label */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <Icon className={`w-4 h-4 ${color.icon}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${color.label}`}>{label}</span>
        {isActive && (
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${color.activePill}`}>
            PLAYING
          </span>
        )}
      </div>
      
      {/* Waveform */}
      <div className="px-3 py-2">
        {!audioUrl && (
          <div className="h-[60px] flex items-center justify-center text-gray-600 text-xs">
            No audio loaded
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
};

const AudioVisualizer = ({ vocalAudioUrl, instrumentalAudioUrl, processedAudioUrl, eqSettings, sections, onSeek }) => {
  const vocalWsRef = useRef(null);
  const instrumentalWsRef = useRef(null);
  const processedWsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState('mixed'); // 'vocal' | 'instrumental' | 'mixed'
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const getActiveWs = useCallback(() => {
    switch (activeTrack) {
      case 'vocal': return vocalWsRef.current;
      case 'instrumental': return instrumentalWsRef.current;
      case 'mixed': return processedWsRef.current;
      default: return processedWsRef.current;
    }
  }, [activeTrack]);

  const stopAll = useCallback(() => {
    [vocalWsRef, instrumentalWsRef, processedWsRef].forEach(ref => {
      if (ref.current && ref.current.isPlaying()) {
        try { ref.current.pause(); } catch (e) {}
      }
    });
  }, []);

  const togglePlayPause = () => {
    const ws = getActiveWs();
    if (!ws) return;

    if (isPlaying) {
      stopAll();
      setIsPlaying(false);
    } else {
      stopAll();
      ws.play();
      setIsPlaying(true);
    }
  };

  const switchTrack = (track) => {
    const wasPlaying = isPlaying;
    const currentWs = getActiveWs();
    const time = currentWs ? currentWs.getCurrentTime() : 0;

    stopAll();
    setActiveTrack(track);

    // After state update, seek & play the new track
    setTimeout(() => {
      const newWs = track === 'vocal' ? vocalWsRef.current
        : track === 'instrumental' ? instrumentalWsRef.current
        : processedWsRef.current;

      if (newWs) {
        try {
          if (newWs.getDuration() > time) {
            newWs.setTime(time);
          }
          if (wasPlaying) {
            newWs.play();
          }
        } catch (e) {}
      }
    }, 50);
  };

  const handleRestart = () => {
    const ws = getActiveWs();
    if (ws) {
      ws.setTime(0);
      if (!isPlaying) {
        ws.play();
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
    if (onSeek) onSeek(time);
  };

  const handleProcessedReady = (ws) => {
    setDuration(ws.getDuration());
  };

  // Expose seek function for external components (MixExplainer)
  const seekTo = useCallback((time) => {
    const ws = getActiveWs();
    if (ws) {
      ws.setTime(time);
      if (!isPlaying) {
        ws.play();
        setIsPlaying(true);
      }
    }
  }, [getActiveWs, isPlaying]);

  // Listen for finish
  useEffect(() => {
    const ws = getActiveWs();
    if (!ws) return;
    const handleFinish = () => setIsPlaying(false);
    ws.on('finish', handleFinish);
    return () => ws.un('finish', handleFinish);
  }, [getActiveWs]);

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const tracks = [
    { key: 'vocal', label: 'Vocal', icon: Mic, color: 'rose' },
    { key: 'instrumental', label: 'Instrumental', icon: Guitar, color: 'cyan' },
    { key: 'mixed', label: 'Mixed (AI)', icon: Sparkles, color: 'violet' },
  ];

  const colorSchemes = {
    vocal: {
      wave: 'rgba(244, 63, 94, 0.3)',
      progress: '#f43f5e',
      icon: 'text-rose-400',
      label: 'text-rose-300',
      activePill: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    },
    instrumental: {
      wave: 'rgba(6, 182, 212, 0.3)',
      progress: '#06b6d4',
      icon: 'text-cyan-400',
      label: 'text-cyan-300',
      activePill: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    },
    mixed: {
      wave: 'rgba(139, 92, 246, 0.3)',
      progress: '#8b5cf6',
      icon: 'text-violet-400',
      label: 'text-violet-300',
      activePill: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel rounded-3xl p-6 md:p-8 w-full max-w-5xl mx-auto flex flex-col gap-6"
    >
      {/* Header + Track Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">Multitrack Analysis</h2>
          {duration > 0 && (
            <span className="text-xs text-gray-500 font-mono bg-white/5 px-2 py-1 rounded">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}
        </div>

        {/* 3-way Track Toggle */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/5">
          {tracks.map(({ key, label, icon: TIcon, color }) => (
            <button
              key={key}
              onClick={() => switchTrack(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTrack === key
                  ? `bg-${color}-500/20 text-${color}-300 shadow-md border border-${color}-500/20`
                  : 'text-gray-400 hover:text-gray-200 border border-transparent'
              }`}
              style={activeTrack === key ? {
                background: key === 'vocal' ? 'rgba(244,63,94,0.15)' :
                             key === 'instrumental' ? 'rgba(6,182,212,0.15)' :
                             'rgba(139,92,246,0.15)',
                color: key === 'vocal' ? '#fda4af' :
                       key === 'instrumental' ? '#67e8f9' :
                       '#c4b5fd',
                boxShadow: key === 'vocal' ? '0 0 15px rgba(244,63,94,0.3)' :
                            key === 'instrumental' ? '0 0 15px rgba(6,182,212,0.3)' :
                            '0 0 15px rgba(139,92,246,0.3)',
              } : {}}
            >
              <TIcon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stacked Waveforms */}
      <div className="flex flex-col gap-3">
        <WaveformLayer
          audioUrl={vocalAudioUrl}
          label="Vocal"
          icon={Mic}
          color={colorSchemes.vocal}
          isActive={activeTrack === 'vocal'}
          syncRef={vocalWsRef}
          onTimeUpdate={activeTrack === 'vocal' ? handleTimeUpdate : undefined}
        />
        <WaveformLayer
          audioUrl={instrumentalAudioUrl}
          label="Instrumental"
          icon={Guitar}
          color={colorSchemes.instrumental}
          isActive={activeTrack === 'instrumental'}
          syncRef={instrumentalWsRef}
          onTimeUpdate={activeTrack === 'instrumental' ? handleTimeUpdate : undefined}
        />
        <WaveformLayer
          audioUrl={processedAudioUrl}
          label="Mixed Output (AI)"
          icon={Sparkles}
          color={colorSchemes.mixed}
          isActive={activeTrack === 'mixed'}
          syncRef={processedWsRef}
          onReady={handleProcessedReady}
          onTimeUpdate={activeTrack === 'mixed' ? handleTimeUpdate : undefined}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleRestart}
          className="flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-full transition-all"
        >
          <SkipBack className="w-5 h-5" />
        </button>
        <button
          onClick={togglePlayPause}
          className="flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-full transition-all transform hover:scale-110 active:scale-95 shadow-[0_0_25px_rgba(59,130,246,0.4)]"
        >
          {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
        </button>
        <div className="w-10" /> {/* Spacer for symmetry */}
      </div>
    </motion.div>
  );
};

export default AudioVisualizer;

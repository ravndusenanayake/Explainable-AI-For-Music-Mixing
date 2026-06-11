import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const AudioVisualizer = ({ originalAudioUrl, processedAudioUrl }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBypass, setIsBypass] = useState(false); // true means play original
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Wavesurfer with beautiful gradient styling
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(59, 130, 246, 0.4)', // Blue-500 transparent
      progressColor: '#8b5cf6', // Violet-500
      cursorColor: '#ffffff',
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 120,
      normalize: true,
      fillParent: true,
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
    });

    ws.on('finish', () => {
      setIsPlaying(false);
    });

    return () => {
      ws.destroy();
    };
  }, []);

  // Load the appropriate audio when urls or bypass toggle change
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    const targetUrl = isBypass ? originalAudioUrl : processedAudioUrl;
    
    if (targetUrl) {
      const currentTime = ws.getCurrentTime();
      const wasPlaying = ws.isPlaying();

      ws.load(targetUrl).then(() => {
        // Seek to the same time to allow seamless A/B comparison
        if (ws.getDuration() > currentTime) {
           ws.setTime(currentTime);
        }
        if (wasPlaying) {
          ws.play();
        }
      });
    }
  }, [isBypass, originalAudioUrl, processedAudioUrl]);

  const togglePlayPause = () => {
    if (!wavesurferRef.current) return;
    if (isPlaying) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel rounded-3xl p-8 w-full max-w-5xl mx-auto flex flex-col gap-8"
    >
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">Audio Analysis</h2>
        
        {/* A/B Test Toggle */}
        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-full border border-white/5">
          <button
            onClick={() => setIsBypass(true)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              isBypass ? 'bg-slate-700 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setIsBypass(false)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              !isBypass ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Processed (AI)
          </button>
        </div>
      </div>

      {/* Waveform Container */}
      <div className="relative bg-black/40 rounded-2xl p-4 border border-white/5 shadow-inner">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl z-10 backdrop-blur-sm">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center">
        <button
          onClick={togglePlayPause}
          disabled={!isReady}
          className="flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-full transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
        >
          {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
        </button>
      </div>
    </motion.div>
  );
};

export default AudioVisualizer;

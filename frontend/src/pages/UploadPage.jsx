import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Music, Layers, Cpu } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const UploadPage = () => {
  const navigate = useNavigate();
  const { resetContext } = useAudioContext();

  const handleStartSession = () => {
    resetContext(); // Ensure clean state
    navigate('/editor');
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 relative">
      {/* Background Glows */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center z-10 max-w-3xl"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-100">Welcome to Mix Studio Pro</span>
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-gray-400 mb-6 tracking-tight">
          Advanced Explainable <br className="hidden md:block"/> AI Mixing
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
          Experience a full DAW environment in your browser. Drag and drop tracks, align clips, and let our Explainable AI instantly generate professional automation and EQ decisions right on your timeline.
        </p>

        <motion.button
          onClick={handleStartSession}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group relative inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-2xl font-bold text-lg text-white shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <span className="relative flex items-center gap-3">
            <Layers className="w-6 h-6" />
            Launch DAW Interface
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </motion.button>
      </motion.div>

      {/* Feature grid */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-5xl w-full z-10"
      >
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 border border-blue-500/30">
            <Layers className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Multi-Track Arranger</h3>
          <p className="text-sm text-gray-400">Drag and drop audio clips onto a powerful grid-based timeline. Align vocals, beats, and instruments perfectly.</p>
        </div>
        
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4 border border-violet-500/30">
            <Cpu className="w-6 h-6 text-violet-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Intelligent Summing</h3>
          <p className="text-sm text-gray-400">Our Node.js engine decodes, pads, and sums your aligned tracks together seamlessly using FFmpeg.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center mb-4 border border-rose-500/30">
            <Sparkles className="w-6 h-6 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">XAI Automation Lanes</h3>
          <p className="text-sm text-gray-400">See exactly what the AI changed with visual automation curves drawn directly over your audio clips.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default UploadPage;

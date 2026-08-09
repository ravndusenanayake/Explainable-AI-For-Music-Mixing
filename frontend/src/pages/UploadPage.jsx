import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Music, AlertCircle, Mic, Guitar, Check, ArrowRight, Sparkles, Waves } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';
import { useNavigate } from 'react-router-dom';

const TrackDropZone = ({ label, icon: Icon, file, onChange, accentColor, inputId, description }) => {
  const colorMap = {
    rose: {
      border: 'hover:border-rose-500/40',
      bg: 'bg-rose-500/10',
      bgHover: 'group-hover:bg-rose-500/20',
      text: 'text-rose-400',
      pill: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      glow: 'shadow-[0_0_30px_rgba(244,63,94,0.15)]',
    },
    cyan: {
      border: 'hover:border-cyan-500/40',
      bg: 'bg-cyan-500/10',
      bgHover: 'group-hover:bg-cyan-500/20',
      text: 'text-cyan-400',
      pill: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      glow: 'shadow-[0_0_30px_rgba(6,182,212,0.15)]',
    },
  };
  const c = colorMap[accentColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: accentColor === 'rose' ? 0.1 : 0.2 }}
      className="flex-1 min-w-[280px]"
    >
      <div className={`glass-panel p-8 md:p-10 rounded-[2rem] text-center border-dashed border-2 border-white/10 ${c.border} hover:bg-white/[0.02] transition-all duration-300 group relative overflow-hidden h-full`}>
        {/* Ambient glow */}
        <div className={`absolute -top-16 -right-16 w-40 h-40 ${c.bg} rounded-full blur-3xl pointer-events-none opacity-50`} />
        
        <input
          type="file"
          id={inputId}
          accept="audio/*"
          className="hidden"
          onChange={onChange}
        />
        <label htmlFor={inputId} className="cursor-pointer flex flex-col items-center gap-5 relative z-10">
          <div className={`w-20 h-20 rounded-full ${c.bg} ${c.bgHover} flex items-center justify-center transition-colors border border-white/10 ${c.glow}`}>
            {file ? (
              <Check className={`w-8 h-8 ${c.text}`} />
            ) : (
              <Icon className={`w-8 h-8 ${c.text} group-hover:scale-110 transition-transform duration-300`} />
            )}
          </div>

          {!file ? (
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">{label}</h3>
              <p className="text-gray-400 text-sm mb-2">{description}</p>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">WAV • MP3 • AIFF</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className={`flex items-center gap-2 ${c.pill} px-4 py-2 rounded-full border text-sm`}>
                <Check className="w-4 h-4" />
                <span className="font-medium truncate max-w-[180px]">{file.name}</span>
              </div>
              <span className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          )}
        </label>
      </div>
    </motion.div>
  );
};

const UploadPage = () => {
  const {
    vocalFile, instrumentalFile,
    handleVocalChange, handleInstrumentalChange,
    handleMix, isLoading, loadingStage, error
  } = useAudioContext();
  const navigate = useNavigate();

  const bothSelected = vocalFile && instrumentalFile;

  const onMixClick = async (e) => {
    e.preventDefault();
    const success = await handleMix();
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-b from-blue-500/20 to-violet-500/10 rounded-3xl mb-6 border border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
          <Sparkles className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-violet-300 tracking-tight mb-4">
          Intelligent Mix Studio
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-light">
          Upload your <span className="text-rose-300 font-medium">vocal</span> and <span className="text-cyan-300 font-medium">instrumental</span> tracks separately.
          Our AI analyzes each bar, mixes them professionally, and explains every decision.
        </p>
      </motion.div>

      {/* Dual Upload Zones */}
      <AnimatePresence mode="wait">
        {!isLoading && (
          <motion.div
            key="upload-zones"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4 }}
            className="max-w-5xl mx-auto"
          >
            <div className="flex flex-col md:flex-row gap-6 mb-8">
              <TrackDropZone
                label="Vocal Track"
                icon={Mic}
                file={vocalFile}
                onChange={handleVocalChange}
                accentColor="rose"
                inputId="vocal-upload"
                description="Your raw vocal recording"
              />
              <TrackDropZone
                label="Instrumental Track"
                icon={Guitar}
                file={instrumentalFile}
                onChange={handleInstrumentalChange}
                accentColor="cyan"
                inputId="instrumental-upload"
                description="The backing instrumental / beat"
              />
            </div>

            {/* Mix Button */}
            <AnimatePresence>
              {bothSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex justify-center"
                >
                  <button
                    onClick={onMixClick}
                    className="group flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-white to-blue-50 text-black hover:from-blue-50 hover:to-violet-50 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.2)] border border-white/20"
                  >
                    <Waves className="w-6 h-6 text-blue-600" />
                    Analyze & Mix
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-3xl mx-auto mt-8 bg-red-500/10 border border-red-500/20 text-red-200 p-5 rounded-2xl flex items-start gap-4 shadow-lg shadow-red-500/10"
          >
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-400" />
            <div>
              <h4 className="font-semibold text-red-300 mb-1">Processing Failed</h4>
              <p className="text-sm">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-3xl mx-auto mt-12 flex flex-col items-center justify-center gap-8 py-12"
        >
          <div className="relative">
            {/* Complex Spinner */}
            <div className="w-36 h-36 border-[4px] border-white/5 border-t-rose-500 rounded-full animate-spin"></div>
            <div className="w-28 h-28 border-[4px] border-white/5 border-b-cyan-500 rounded-full animate-spin absolute top-4 left-4" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="w-20 h-20 border-[4px] border-white/5 border-t-violet-500 rounded-full animate-spin absolute top-8 left-8" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-3">AI is Mixing Your Tracks...</h3>
            <p className="text-gray-400 max-w-md mx-auto mb-4">
              Analyzing frequency content, balancing levels, applying intelligent EQ decisions, and generating explanations for every section.
            </p>
            {loadingStage && (
              <motion.div
                key={loadingStage}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-300 px-4 py-2 rounded-full border border-blue-500/20 text-sm"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                {loadingStage}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* How It Works Section */}
      {!isLoading && !bothSelected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-4xl mx-auto mt-16"
        >
          <h3 className="text-center text-gray-500 text-sm font-semibold uppercase tracking-widest mb-8">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Upload Tracks', desc: 'Drop your raw vocal and instrumental files separately', icon: UploadCloud },
              { step: '02', title: 'AI Analysis', desc: 'Each bar is analyzed for frequency, dynamics, and balance', icon: Sparkles },
              { step: '03', title: 'Mixed Output', desc: 'Get a polished mix with explained decisions per section', icon: Music },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="glass-panel rounded-2xl p-6 text-center border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="text-3xl font-black text-white/10 mb-3">{item.step}</div>
                <item.icon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h4 className="text-white font-semibold mb-2">{item.title}</h4>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UploadPage;

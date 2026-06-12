import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Music, AlertCircle, FileAudio, Check, ArrowRight } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';
import { useNavigate } from 'react-router-dom';

const UploadPage = () => {
  const { file, handleFileChange, handleUpload, isLoading, error } = useAudioContext();
  const navigate = useNavigate();

  const onUploadClick = async (e) => {
    e.preventDefault();
    const success = await handleUpload();
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 relative">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <div className="inline-flex items-center justify-center p-4 bg-gradient-to-b from-blue-500/20 to-blue-500/5 rounded-3xl mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
          <Music className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-blue-300 tracking-tight mb-6">
          Intelligent Mix Assistant
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-light">
          Upload your multitrack mix. Our Explainable AI analyzes the DSP chain, optimizes the audio, and clearly explains every decision it makes.
        </p>
      </motion.div>

      {/* Upload Section */}
      <AnimatePresence mode="wait">
        {!isLoading && (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto"
          >
            <div className="glass-panel p-10 md:p-16 rounded-[2.5rem] text-center border-dashed border-2 border-white/10 hover:border-blue-500/40 hover:bg-white/[0.02] transition-all duration-300 group">
              <input
                type="file"
                id="audio-upload"
                accept="audio/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <label 
                htmlFor="audio-upload"
                className="cursor-pointer flex flex-col items-center gap-6"
              >
                <div className="w-24 h-24 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors border border-blue-500/20">
                  {file ? <FileAudio className="w-10 h-10 text-blue-400" /> : <UploadCloud className="w-10 h-10 text-blue-400 group-hover:scale-110 transition-transform duration-300" />}
                </div>
                
                {!file ? (
                  <div>
                    <h3 className="text-2xl font-semibold text-white mb-2">Upload Audio Track</h3>
                    <p className="text-gray-400 mb-2">Drag and drop or click to browse</p>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">WAV • MP3 • AIFF</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-3 bg-blue-500/10 text-blue-300 px-6 py-3 rounded-full border border-blue-500/20 mb-8">
                      <Check className="w-5 h-5" />
                      <span className="font-medium truncate max-w-xs">{file.name}</span>
                    </div>
                    <button
                      onClick={onUploadClick}
                      className="group flex items-center gap-2 px-8 py-4 bg-white text-black hover:bg-blue-50 rounded-2xl font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                    >
                      Analyze & Mix
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                )}
              </label>
            </div>
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
            className="max-w-2xl mx-auto mt-8 bg-red-500/10 border border-red-500/20 text-red-200 p-5 rounded-2xl flex items-start gap-4 shadow-lg shadow-red-500/10"
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
          className="max-w-2xl mx-auto mt-16 flex flex-col items-center justify-center gap-8 py-12"
        >
          <div className="relative">
            {/* Complex Spinner */}
            <div className="w-32 h-32 border-[4px] border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="w-24 h-24 border-[4px] border-white/5 border-b-violet-500 rounded-full animate-spin absolute top-4 left-4" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Music className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-3">AI is Analyzing Audio...</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
              Running DSP algorithms, applying dynamic EQs, and generating explainable insights. This might take a few moments.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default UploadPage;

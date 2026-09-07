import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Loader2, CheckCircle2, AlertCircle, Music, ChevronDown, Info, Zap } from 'lucide-react';
import { useAudioContext } from '../context/AudioContext';

const AudioAligner = () => {
  const { tracks, handleAlignment, isLoading, loadingStage } = useAudioContext();

  const [referenceTrackId, setReferenceTrackId] = useState('');
  const [targetTrackIds, setTargetTrackIds] = useState([]);
  const [alignmentResult, setAlignmentResult] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const tracksWithClips = tracks.filter(t => t.clips.length > 0);
  const availableTargets = tracksWithClips.filter(t => t.id !== referenceTrackId);

  const toggleTarget = (trackId) => {
    setTargetTrackIds(prev =>
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const handleAlign = async () => {
    if (!referenceTrackId || targetTrackIds.length === 0) return;

    const result = await handleAlignment(referenceTrackId, targetTrackIds);
    if (result) {
      setAlignmentResult(result);
      setShowResult(true);
    }
  };

  const selectAllTargets = () => {
    setTargetTrackIds(availableTargets.map(t => t.id));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#161616] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">Audio Alignment</span>
          <span className="text-[10px] text-gray-500 ml-2">Sync multiple vocal tracks together</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tracksWithClips.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
            <Link2 className="w-10 h-10 mb-3 opacity-30" />
            <h3 className="text-sm font-bold text-gray-400 mb-1">Need at Least 2 Tracks</h3>
            <p className="text-xs text-center max-w-sm">
              Add audio clips to at least 2 tracks (e.g., Lead Vocal + Backing Vocal)
              to use audio alignment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {/* Step 1: Reference Track */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                  <span className="text-emerald-400 text-[10px] font-bold">1</span>
                </div>
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Reference Track</h3>
              </div>
              <p className="text-[10px] text-gray-500 mb-3">Select the main vocal to align everything to</p>

              <div className="space-y-1.5">
                {tracksWithClips.map(track => (
                  <button
                    key={track.id}
                    onClick={() => {
                      setReferenceTrackId(track.id);
                      setTargetTrackIds(prev => prev.filter(id => id !== track.id));
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all ${
                      referenceTrackId === track.id
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-[#111] border border-[#333] text-gray-400 hover:text-gray-200 hover:border-[#444]'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      track.color === 'rose' ? 'bg-rose-500' :
                      track.color === 'pink' ? 'bg-pink-500' :
                      track.color === 'cyan' ? 'bg-cyan-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-[11px] font-bold flex-1">{track.name}</span>
                    {referenceTrackId === track.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Target Tracks */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                  <span className="text-cyan-400 text-[10px] font-bold">2</span>
                </div>
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Target Tracks</h3>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-gray-500">Tracks to align to the reference</p>
                {availableTargets.length > 1 && (
                  <button
                    onClick={selectAllTargets}
                    className="text-[9px] text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    Select All
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {availableTargets.length === 0 ? (
                  <p className="text-[10px] text-gray-600 italic py-4 text-center">
                    {referenceTrackId ? 'No other tracks with clips available' : 'Select a reference track first'}
                  </p>
                ) : (
                  availableTargets.map(track => (
                    <button
                      key={track.id}
                      onClick={() => toggleTarget(track.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-all ${
                        targetTrackIds.includes(track.id)
                          ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                          : 'bg-[#111] border border-[#333] text-gray-400 hover:text-gray-200 hover:border-[#444]'
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        track.color === 'rose' ? 'bg-rose-500' :
                        track.color === 'pink' ? 'bg-pink-500' :
                        track.color === 'cyan' ? 'bg-cyan-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-[11px] font-bold flex-1">{track.name}</span>
                      {targetTrackIds.includes(track.id) && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Step 3: Align */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-violet-500/20 rounded-full flex items-center justify-center border border-violet-500/30">
                  <span className="text-violet-400 text-[10px] font-bold">3</span>
                </div>
                <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Align</h3>
              </div>
              <p className="text-[10px] text-gray-500 mb-4">
                One click to auto-sync all selected tracks to the reference.
              </p>

              <button
                onClick={handleAlign}
                disabled={isLoading || !referenceTrackId || targetTrackIds.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-30 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {loadingStage || 'Aligning...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    1-Click Align
                  </>
                )}
              </button>

              {/* Results */}
              <AnimatePresence>
                {showResult && alignmentResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 space-y-2"
                  >
                    <div className="flex items-center gap-1 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400">Alignment Complete</span>
                    </div>

                    {alignmentResult.explanations?.map((exp, i) => (
                      <div key={i} className="bg-[#111] border border-[#333] rounded p-2">
                        <p className="text-[10px] text-gray-200 font-bold">{exp.action}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{exp.reason}</p>
                      </div>
                    ))}

                    {alignmentResult.alignments?.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-[#111] border border-[#333] rounded p-2">
                        <Link2 className="w-3 h-3 text-cyan-400" />
                        <span className="text-[10px] text-gray-300 font-mono">
                          {a.originalName}: {a.global_delay_ms > 0 ? '+' : ''}{a.global_delay_ms?.toFixed(1)}ms
                        </span>
                        <span className="text-[9px] text-gray-500 ml-auto">
                          {((a.confidence || 0) * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioAligner;

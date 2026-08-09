import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AudioVisualizer from '../components/AudioVisualizer';
import XAIDashboard from '../components/XAIDashboard';
import DSPControls from '../components/DSPControls';
import VocalEQGuide from '../components/VocalEQGuide';
import MixExplainer from '../components/MixExplainer';
import { useAudioContext } from '../context/AudioContext';

const OverviewPage = () => {
  const {
    vocalAudioUrl, instrumentalAudioUrl,
    processedAudioUrl, eqSettings, setEqSettings,
    explanations, sections, globalSummary
  } = useAudioContext();

  const [currentTime, setCurrentTime] = useState(0);
  const [seekCallback, setSeekCallback] = useState(null);

  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-10"
    >
      {/* Multi-track Audio Visualizer */}
      <AudioVisualizer
        vocalAudioUrl={vocalAudioUrl}
        instrumentalAudioUrl={instrumentalAudioUrl}
        processedAudioUrl={processedAudioUrl}
        eqSettings={eqSettings}
        sections={sections}
        onSeek={handleTimeUpdate}
      />

      {/* Bar-by-Bar Mix Explainer */}
      {sections && sections.length > 0 && (
        <MixExplainer
          sections={sections}
          currentTime={currentTime}
          globalSummary={globalSummary}
        />
      )}

      {/* DSP Controls & Vocal EQ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <DSPControls />
        <VocalEQGuide
          eqSettings={eqSettings}
          onEqChange={setEqSettings}
        />
      </div>

      {/* Legacy XAI Dashboard */}
      <XAIDashboard explanations={explanations} />
    </motion.div>
  );
};

export default OverviewPage;

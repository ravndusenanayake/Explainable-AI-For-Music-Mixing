import React from 'react';
import { motion } from 'framer-motion';
import AudioVisualizer from '../components/AudioVisualizer';
import XAIDashboard from '../components/XAIDashboard';
import { useAudioContext } from '../context/AudioContext';

const OverviewPage = () => {
  const { originalAudioUrl, processedAudioUrl, eqSettings, explanations } = useAudioContext();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-12"
    >
      <AudioVisualizer 
        originalAudioUrl={originalAudioUrl} 
        processedAudioUrl={processedAudioUrl}
        eqSettings={eqSettings}
      />
      <XAIDashboard explanations={explanations} />
    </motion.div>
  );
};

export default OverviewPage;

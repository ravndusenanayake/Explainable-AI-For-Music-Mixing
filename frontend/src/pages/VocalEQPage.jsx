import React from 'react';
import { motion } from 'framer-motion';
import VocalEQGuide from '../components/VocalEQGuide';
import { useAudioContext } from '../context/AudioContext';

const VocalEQPage = () => {
  const { eqSettings, setEqSettings } = useAudioContext();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <VocalEQGuide 
        eqSettings={eqSettings}
        onEqChange={setEqSettings}
      />
    </motion.div>
  );
};

export default VocalEQPage;

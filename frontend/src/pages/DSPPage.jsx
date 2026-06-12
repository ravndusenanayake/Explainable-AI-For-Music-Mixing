import React from 'react';
import { motion } from 'framer-motion';
import DSPControls from '../components/DSPControls';

const DSPPage = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <DSPControls />
    </motion.div>
  );
};

export default DSPPage;

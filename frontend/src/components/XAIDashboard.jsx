import React from 'react';
import { motion } from 'framer-motion';
import { Info, Cpu, CheckCircle2 } from 'lucide-react';

const XAIDashboard = ({ explanations }) => {
  if (!explanations || explanations.length === 0) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-4">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="p-2 bg-violet-500/20 rounded-xl border border-violet-500/30">
          <Cpu className="w-6 h-6 text-violet-400" />
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Diagnostic Explanations</h2>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {explanations.map((exp, index) => (
          <motion.div 
            key={index} 
            variants={cardVariants}
            className="glass-panel rounded-2xl p-6 border-t-4 border-t-blue-500 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(59,130,246,0.15)] transition-all duration-300 relative overflow-hidden group flex flex-col h-full"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />

            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white flex items-start gap-2 leading-tight">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  {exp.action || 'Optimization Applied'}
                </h3>
              </div>
              
              <div className="bg-black/30 rounded-xl p-4 text-sm text-gray-300 border border-white/5 flex-grow mb-4 leading-relaxed">
                <span className="font-semibold text-blue-300 block mb-1">Reason for action:</span>
                {exp.reason || 'No specific reason provided.'}
              </div>

              {exp.tip && (
                <div className="mt-auto pt-4 border-t border-white/10 flex items-start gap-3 text-sm text-violet-300">
                  <div className="bg-violet-500/10 p-1.5 rounded-lg flex-shrink-0 border border-violet-500/20">
                    <Info className="w-4 h-4" />
                  </div>
                  <p className="leading-relaxed"><span className="font-semibold text-white">Pro Tip:</span> {exp.tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default XAIDashboard;

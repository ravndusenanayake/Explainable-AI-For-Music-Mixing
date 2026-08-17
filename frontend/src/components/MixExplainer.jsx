import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Clock, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Mic, Guitar, Info,
  CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Play
} from 'lucide-react';

const severityConfig = {
  optimal: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
    label: 'Optimal',
    glow: 'shadow-[0_0_10px_rgba(52,211,153,0.1)]',
  },
  adjusted: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: AlertTriangle,
    label: 'Adjusted',
    glow: 'shadow-[0_0_10px_rgba(251,191,36,0.1)]',
  },
  significant: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: AlertCircle,
    label: 'Significant',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.1)]',
  },
};

const sectionTypeColors = {
  'Intro': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Verse': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Pre-Chorus': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Chorus': 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Bridge': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'Outro': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'Instrumental Break': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'A Cappella': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'Silence': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const GainIndicator = ({ value, label, icon: Icon, color }) => {
  const displayValue = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-gray-400">{label}:</span>
      <span className={`font-mono font-semibold ${
        value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400'
      }`}>
        {value === 0 ? '0.0' : displayValue} dB
      </span>
      {value > 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> :
       value < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
       <Minus className="w-3 h-3 text-gray-500" />}
    </div>
  );
};

const SectionCard = ({ section, isActive, isExpanded, onToggle, onSeek }) => {
  const severity = severityConfig[section.mixing.severity] || severityConfig.optimal;
  const SeverityIcon = severity.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        isActive
          ? `${severity.border} ${severity.bg} ${severity.glow} ring-1 ring-white/10`
          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]'
      }`}
    >
      {/* Card Header — Always Visible */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Section index */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${severity.bg} ${severity.color}`}>
          {section.index + 1}
        </div>

        {/* Time range */}
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-gray-300 font-mono text-xs">
            {section.startTimeFormatted} – {section.endTimeFormatted}
          </span>
        </div>

        {/* Section type badge */}
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
          sectionTypeColors[section.sectionType] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
        }`}>
          {section.sectionType}
        </span>

        {/* Severity indicator */}
        <div className={`flex items-center gap-1 ml-auto ${severity.color}`}>
          <SeverityIcon className="w-4 h-4" />
          <span className="text-[10px] font-semibold hidden sm:block">{severity.label}</span>
        </div>

        {/* Play button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSeek(section.startTime);
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Play from this section"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* Expand chevron */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              {/* Gain Adjustments */}
              <div className="flex flex-wrap gap-4">
                <GainIndicator
                  value={section.mixing.vocalGainDb}
                  label="Vocal"
                  icon={Mic}
                  color="text-rose-400"
                />
                <GainIndicator
                  value={section.mixing.instrumentalGainDb}
                  label="Instrumental"
                  icon={Guitar}
                  color="text-cyan-400"
                />
              </div>

              {/* Analysis Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Vocal RMS', value: `${section.analysis.vocalRmsDb} dB`, sub: 'Loudness' },
                  { label: 'Vocal Peak', value: `${section.analysis.vocalPeakDb} dB`, sub: 'Max level' },
                  { label: 'Inst. RMS', value: `${section.analysis.instrumentalRmsDb} dB`, sub: 'Loudness' },
                  { label: 'Inst. Peak', value: `${section.analysis.instrumentalPeakDb} dB`, sub: 'Max level' },
                ].map((metric, i) => (
                  <div key={i} className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{metric.label}</div>
                    <div className="text-sm font-mono text-white font-semibold">{metric.value}</div>
                    <div className="text-[10px] text-gray-600">{metric.sub}</div>
                  </div>
                ))}
              </div>

              {/* Explanations */}
              {section.explanations && section.explanations.length > 0 && (
                <div className="space-y-3">
                  {section.explanations.map((exp, idx) => (
                    <div key={idx} className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <div className="flex items-start gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <h4 className="text-sm font-semibold text-white">{exp.action}</h4>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed ml-6 mb-2">
                        {exp.reason}
                      </p>
                      {exp.tip && (
                        <div className="ml-6 flex items-start gap-2 text-xs text-violet-300 bg-violet-500/5 rounded-lg p-2.5 border border-violet-500/10">
                          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <p><span className="font-semibold text-white">Pro Tip:</span> {exp.tip}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Summary */}
              {section.mixing.actions && section.mixing.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {section.mixing.actions.map((action, i) => (
                    <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/5">
                      {action}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const MixExplainer = ({ sections, currentTime, onSeek, globalSummary, simpleExplanations }) => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'significant' | 'adjusted' | 'optimal'
  const [viewMode, setViewMode] = useState('simple');
  const containerRef = useRef(null);

  // Find the currently active section based on playback time
  const activeIndex = sections.findIndex(
    s => currentTime >= s.startTime && currentTime < s.endTime
  );

  // Auto-expand active section
  useEffect(() => {
    if (activeIndex >= 0 && expandedIndex === null) {
      setExpandedIndex(activeIndex);
    }
  }, [activeIndex]);

  const filteredSections = filter === 'all'
    ? sections
    : sections.filter(s => s.mixing.severity === filter);

  const stats = {
    optimal: sections.filter(s => s.mixing.severity === 'optimal').length,
    adjusted: sections.filter(s => s.mixing.severity === 'adjusted').length,
    significant: sections.filter(s => s.mixing.severity === 'significant').length,
  };

  if (!sections || sections.length === 0) return null;

  return (
    <div className="w-full max-w-5xl mx-auto mt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-xl border border-white/10">
            <Sparkles className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">AI Mix Explanations</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              Understand exactly what the AI did to your tracks
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setViewMode('simple')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'simple' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Simple View
          </button>
          <button
            onClick={() => setViewMode('advanced')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              viewMode === 'advanced' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Advanced View
          </button>
        </div>
      </div>

      {/* Global Summary Banner */}
      {globalSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-5 mb-6 border border-blue-500/10"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-blue-200 mb-1">AI Mix Summary</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{globalSummary.summary}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {Object.entries(globalSummary.sectionBreakdown || {}).map(([type, count]) => (
                  <span key={type} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                    sectionTypeColors[type] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'
                  }`}>
                    {count}× {type}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {viewMode === 'simple' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {simpleExplanations && simpleExplanations.map((exp, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-black/40 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-white font-bold text-lg">{exp.action}</h3>
              </div>
              <p className="text-gray-400 leading-relaxed text-sm">
                {exp.reason}
              </p>
            </motion.div>
          ))}
          {(!simpleExplanations || simpleExplanations.length === 0) && (
            <div className="col-span-2 text-center py-12 text-gray-500">
              Your mix was already perfectly balanced! The AI did not need to make any adjustments.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Advanced View Filters */}
          <div className="flex items-center gap-1 bg-black/30 p-1 rounded-full border border-white/5 mb-6 w-fit mx-2">
            {[
              { key: 'all', label: `All Sections (${sections.length})` },
              { key: 'significant', label: `Significant Changes (${stats.significant})`, color: 'rose' },
              { key: 'adjusted', label: `Minor Tweaks (${stats.adjusted})`, color: 'amber' },
              { key: 'optimal', label: `Optimal (${stats.optimal})`, color: 'emerald' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === f.key
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.color && (
                  <div className={`w-2 h-2 rounded-full ${
                    f.color === 'rose' ? 'bg-rose-400' :
                    f.color === 'amber' ? 'bg-amber-400' :
                    'bg-emerald-400'
                  }`} />
                )}
                {f.label}
              </button>
            ))}
          </div>

          {/* Section Cards */}
          <div ref={containerRef} className="flex flex-col gap-3">
            {filteredSections.map((section) => (
              <SectionCard
                key={section.index}
                section={section}
                isActive={activeIndex === section.index}
                isExpanded={expandedIndex === section.index}
                onToggle={() => setExpandedIndex(expandedIndex === section.index ? null : section.index)}
                onSeek={onSeek || (() => {})}
              />
            ))}
          </div>

          {filteredSections.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No sections match the selected filter.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MixExplainer;

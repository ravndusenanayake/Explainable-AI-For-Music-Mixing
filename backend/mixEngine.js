const WavDecoder = require('wav-decoder');
const WavEncoder = require('wav-encoder');

// ============================================================
// CONSTANTS
// ============================================================
const BAR_DURATION_SECONDS = 4; // Approximate bar length for segment analysis
const SAMPLE_RATE = 44100;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calculate RMS (Root Mean Square) energy of an audio segment.
 * This gives us a good measure of perceived loudness.
 */
function calculateRMS(samples, start, end) {
  let sum = 0;
  const len = Math.min(end, samples.length) - start;
  if (len <= 0) return 0;
  for (let i = start; i < Math.min(end, samples.length); i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / len);
}

/**
 * Calculate peak amplitude of an audio segment.
 */
function calculatePeak(samples, start, end) {
  let peak = 0;
  for (let i = start; i < Math.min(end, samples.length); i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

/**
 * Calculate spectral centroid approximation using zero-crossing rate.
 * Higher zero-crossing rate ≈ more high-frequency content.
 * This is a lightweight proxy for full FFT spectral analysis.
 */
function calculateZeroCrossingRate(samples, start, end) {
  let crossings = 0;
  const len = Math.min(end, samples.length) - start;
  if (len <= 1) return 0;
  for (let i = start + 1; i < Math.min(end, samples.length); i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / len;
}

/**
 * Calculate crest factor (peak / RMS). 
 * High crest factor = very dynamic, low = compressed/consistent.
 */
function calculateCrestFactor(peak, rms) {
  if (rms === 0) return 0;
  return peak / rms;
}

/**
 * Convert linear amplitude to dB.
 */
function linearToDb(value) {
  if (value <= 0) return -Infinity;
  return 20 * Math.log10(value);
}

/**
 * Classify a section based on energy profile.
 */
function classifySection(vocalRMS, instrumentalRMS, sectionIndex, totalSections) {
  const position = sectionIndex / totalSections;
  const vocalDb = linearToDb(vocalRMS);
  const instDb = linearToDb(instrumentalRMS);

  // Silence detection
  if (vocalDb < -50 && instDb < -50) return 'Silence';
  if (vocalDb < -40 && instDb > -30) return 'Instrumental Break';
  if (vocalDb > -30 && instDb < -40) return 'A Cappella';

  // Position-based heuristics
  if (position < 0.08) return 'Intro';
  if (position > 0.92) return 'Outro';

  // Energy-based classification
  const totalEnergy = vocalRMS + instrumentalRMS;
  if (totalEnergy > 0.3) return 'Chorus';
  if (totalEnergy > 0.15) return 'Verse';
  if (totalEnergy > 0.05) return 'Pre-Chorus';
  return 'Bridge';
}

// ============================================================
// SEGMENT ANALYSIS
// ============================================================

/**
 * Analyze a single segment of both vocal and instrumental tracks.
 * Returns detailed metrics for mixing decisions.
 */
function analyzeSegment(vocalSamples, instrumentalSamples, start, end, sampleRate) {
  const vocalRMS = calculateRMS(vocalSamples, start, end);
  const vocalPeak = calculatePeak(vocalSamples, start, end);
  const vocalZCR = calculateZeroCrossingRate(vocalSamples, start, end);
  const vocalCrest = calculateCrestFactor(vocalPeak, vocalRMS);

  const instRMS = calculateRMS(instrumentalSamples, start, end);
  const instPeak = calculatePeak(instrumentalSamples, start, end);
  const instZCR = calculateZeroCrossingRate(instrumentalSamples, start, end);
  const instCrest = calculateCrestFactor(instPeak, instRMS);

  return {
    vocal: {
      rms: vocalRMS,
      rmsDb: linearToDb(vocalRMS),
      peak: vocalPeak,
      peakDb: linearToDb(vocalPeak),
      zeroCrossingRate: vocalZCR,
      crestFactor: vocalCrest,
      isSilent: vocalRMS < 0.005,
    },
    instrumental: {
      rms: instRMS,
      rmsDb: linearToDb(instRMS),
      peak: instPeak,
      peakDb: linearToDb(instPeak),
      zeroCrossingRate: instZCR,
      crestFactor: instCrest,
      isSilent: instRMS < 0.005,
    }
  };
}

// ============================================================
// MIXING DECISION ENGINE
// ============================================================

/**
 * Make mixing decisions for a segment based on analysis.
 * Returns gain adjustments, EQ suggestions, and explanations.
 */
function makeMixingDecisions(analysis, sectionType, sectionIndex) {
  const decisions = {
    vocalGainDb: 0,
    instrumentalGainDb: 0,
    actions: [],
    explanations: [],
    severity: 'optimal', // 'optimal' | 'adjusted' | 'significant'
  };

  const { vocal, instrumental } = analysis;

  // ── 1. Silence / Near-Silence Handling ──
  if (vocal.isSilent && instrumental.isSilent) {
    decisions.actions.push('Maintained silence');
    decisions.explanations.push({
      action: 'No processing applied',
      reason: 'Both tracks are silent in this section.',
      tip: 'Silent gaps are normal between sections. No processing needed.'
    });
    return decisions;
  }

  // ── 2. Vocal-Instrument Balance ──
  if (!vocal.isSilent && !instrumental.isSilent) {
    const balanceDb = vocal.rmsDb - instrumental.rmsDb;

    if (sectionType === 'Chorus') {
      // Chorus: vocal should be prominent but instruments should be full
      if (balanceDb < -3) {
        const boost = Math.min(6, Math.abs(balanceDb) * 0.6);
        decisions.vocalGainDb += boost;
        decisions.severity = 'adjusted';
        decisions.actions.push(`Boosted vocal by +${boost.toFixed(1)}dB`);
        decisions.explanations.push({
          action: `Vocal Boost: +${boost.toFixed(1)}dB`,
          reason: `In this Chorus section, the vocal was sitting ${Math.abs(balanceDb).toFixed(1)}dB below the instrumental. Choruses need the vocal to cut through clearly.`,
          tip: 'In choruses, vocals should sit 2-4dB above the instrumental bed to maintain emotional impact and clarity.'
        });
      } else if (balanceDb > 6) {
        const cut = Math.min(4, balanceDb * 0.4);
        decisions.instrumentalGainDb += cut;
        decisions.severity = 'adjusted';
        decisions.actions.push(`Boosted instrumental by +${cut.toFixed(1)}dB`);
        decisions.explanations.push({
          action: `Instrumental Lift: +${cut.toFixed(1)}dB`,
          reason: `The instrumental was too quiet relative to the vocal (${balanceDb.toFixed(1)}dB gap). Choruses need a full, powerful backing.`,
          tip: 'A full-sounding chorus relies on both vocal and instrumental energy working together. Don\'t let the backing track disappear.'
        });
      } else {
        decisions.actions.push('Balance already optimal for chorus');
        decisions.explanations.push({
          action: 'Vocal-Instrument Balance: Optimal',
          reason: `Both tracks are well-balanced for a chorus section (${balanceDb > 0 ? '+' : ''}${balanceDb.toFixed(1)}dB vocal relative to instrumental).`,
          tip: 'A balanced chorus with vocal 2-4dB above the instrumental creates the best impact.'
        });
      }
    } else if (sectionType === 'Verse') {
      // Verse: vocal should be clearly above instrumental
      if (balanceDb < 0) {
        const boost = Math.min(8, Math.abs(balanceDb) * 0.7);
        decisions.vocalGainDb += boost;
        decisions.instrumentalGainDb -= Math.min(2, boost * 0.3);
        decisions.severity = 'significant';
        decisions.actions.push(`Boosted vocal by +${boost.toFixed(1)}dB, ducked instrumental by -${Math.min(2, boost * 0.3).toFixed(1)}dB`);
        decisions.explanations.push({
          action: `Vocal Priority Adjustment: +${boost.toFixed(1)}dB vocal, -${Math.min(2, boost * 0.3).toFixed(1)}dB instrumental`,
          reason: `In this Verse, the vocal was buried under the instrumental by ${Math.abs(balanceDb).toFixed(1)}dB. Verses carry the lyrical narrative — the words must be clearly audible.`,
          tip: 'Verses are storytelling sections. Keep the instrumental bed 4-6dB below the vocal so lyrics are crystal clear.'
        });
      } else {
        decisions.actions.push('Verse balance is good');
        decisions.explanations.push({
          action: 'Verse Balance: Good',
          reason: `Vocal sits ${balanceDb.toFixed(1)}dB above the instrumental, providing good lyrical clarity.`,
          tip: 'In verses, the vocal should lead. This balance lets the listener focus on the lyrics.'
        });
      }
    } else if (sectionType === 'Bridge') {
      // Bridge: usually a transition, keep both moderate
      const targetBalance = 2; // vocal slightly above
      const diff = balanceDb - targetBalance;
      if (Math.abs(diff) > 3) {
        decisions.vocalGainDb -= diff * 0.3;
        decisions.severity = 'adjusted';
        decisions.actions.push(`Adjusted vocal by ${(-diff * 0.3).toFixed(1)}dB for bridge balance`);
        decisions.explanations.push({
          action: `Bridge Balance Adjustment: ${(-diff * 0.3) > 0 ? '+' : ''}${(-diff * 0.3).toFixed(1)}dB vocal`,
          reason: `Bridge sections create contrast. The current balance needed ${Math.abs(diff).toFixed(1)}dB correction to achieve an intimate, balanced feel.`,
          tip: 'Bridges are emotional pivots. A slightly softer vocal with moderate instrumental creates anticipation for the final chorus.'
        });
      }
    } else if (sectionType === 'Instrumental Break') {
      decisions.vocalGainDb = -60; // effectively mute
      decisions.actions.push('Muted vocal for instrumental break');
      decisions.explanations.push({
        action: 'Vocal Muted',
        reason: 'No vocal content detected in this section. This is an instrumental break — letting the backing track breathe.',
        tip: 'Instrumental breaks give the listener a chance to appreciate the music arrangement. Let the instruments shine.'
      });
    }
  } else if (vocal.isSilent && !instrumental.isSilent) {
    decisions.actions.push('Instrumental only — no vocal processing needed');
    decisions.explanations.push({
      action: 'Instrumental Solo Section',
      reason: 'No vocal content detected. The instrumental plays alone in this section.',
      tip: 'Instrumental sections are great opportunities to showcase the arrangement and build energy.'
    });
  } else if (!vocal.isSilent && instrumental.isSilent) {
    decisions.actions.push('A cappella section — vocal only');
    decisions.explanations.push({
      action: 'A Cappella Section',
      reason: 'No instrumental content detected. The vocal stands alone, creating an intimate moment.',
      tip: 'A cappella moments are powerful. Consider adding very subtle reverb to prevent the vocal from sounding too dry.'
    });
  }

  // ── 3. Dynamic Range / Compression Analysis ──
  if (!vocal.isSilent && vocal.crestFactor > 6) {
    const compressionNote = 'Vocal has very high dynamic range';
    decisions.severity = decisions.severity === 'optimal' ? 'adjusted' : decisions.severity;
    decisions.actions.push(compressionNote);
    decisions.explanations.push({
      action: 'Compression Recommended: Vocal Dynamics',
      reason: `Vocal crest factor is ${vocal.crestFactor.toFixed(1)} (peak ${vocal.peakDb.toFixed(1)}dB vs RMS ${vocal.rmsDb.toFixed(1)}dB). This means loud parts are much louder than quiet parts, making it hard to sit consistently in the mix.`,
      tip: 'Apply gentle compression (2:1 ratio, medium attack) to even out the vocal dynamics without squashing the natural feel.'
    });
  }

  if (!instrumental.isSilent && instrumental.crestFactor > 8) {
    decisions.actions.push('Instrumental has very wide dynamics');
    decisions.explanations.push({
      action: 'Dynamics Warning: Instrumental',
      reason: `Instrumental crest factor is ${instrumental.crestFactor.toFixed(1)}. The peaks are much louder than the average level, which can cause the mix to feel inconsistent.`,
      tip: 'Bus compression on the instrumental (2-4:1 ratio) will glue the elements together and provide a more consistent bed for the vocal.'
    });
  }

  // ── 4. High-Frequency Content Analysis (ZCR as proxy) ──
  if (!vocal.isSilent && vocal.zeroCrossingRate > 0.3) {
    decisions.actions.push('High sibilance/brightness detected in vocal');
    decisions.explanations.push({
      action: 'De-Essing Recommended',
      reason: `High zero-crossing rate (${(vocal.zeroCrossingRate * 100).toFixed(0)}%) indicates significant high-frequency content — likely harsh "S" and "T" sounds (sibilance).`,
      tip: 'Apply a de-esser targeting 5-8kHz to tame sibilance without dulling the overall vocal brightness.'
    });
  }

  if (!instrumental.isSilent && instrumental.zeroCrossingRate > 0.35) {
    decisions.actions.push('Bright instrumental may compete with vocal airiness');
    decisions.explanations.push({
      action: 'EQ Suggestion: Instrumental High-Cut',
      reason: `The instrumental has very high brightness (ZCR: ${(instrumental.zeroCrossingRate * 100).toFixed(0)}%). This may mask the vocal\'s "air" and presence frequencies (8-16kHz).`,
      tip: 'A gentle high shelf cut (-2dB at 10kHz) on the instrumental creates space for the vocal to breathe in the upper frequencies.'
    });
  }

  // ── 5. Peak Limiting Check ──
  if (!vocal.isSilent && vocal.peak > 0.95) {
    decisions.severity = 'significant';
    decisions.vocalGainDb -= 2;
    decisions.actions.push('Vocal peak near clipping — applied -2dB safety cut');
    decisions.explanations.push({
      action: 'Peak Limiter: Vocal -2dB',
      reason: `Vocal peaks at ${vocal.peakDb.toFixed(1)}dB, dangerously close to 0dBFS (digital clipping). Applied a 2dB safety margin.`,
      tip: 'Always keep peaks below -1dBTP (True Peak). Streaming platforms like Spotify and Apple Music will flag or distort clipped audio.'
    });
  }

  if (!instrumental.isSilent && instrumental.peak > 0.95) {
    decisions.severity = 'significant';
    decisions.instrumentalGainDb -= 2;
    decisions.actions.push('Instrumental peak near clipping — applied -2dB safety cut');
    decisions.explanations.push({
      action: 'Peak Limiter: Instrumental -2dB',
      reason: `Instrumental peaks at ${instrumental.peakDb.toFixed(1)}dB, near digital clipping. Applied a safety reduction.`,
      tip: 'Leave headroom in your mix. A good target is -6dBFS for the mix bus before mastering.'
    });
  }

  return decisions;
}

// ============================================================
// MAIN MIXING PIPELINE
// ============================================================

/**
 * Main entry point: takes two WAV buffers, analyzes, mixes, and returns results.
 * @param {Buffer} vocalBuffer - Raw WAV file buffer for the vocal track
 * @param {Buffer} instrumentalBuffer - Raw WAV file buffer for the instrumental track
 * @returns {Object} { mixedAudioBuffer, sections, globalSummary, explanations }
 */
async function mixTracks(vocalBuffer, instrumentalBuffer) {
  console.log('[MixEngine] Starting audio analysis and mixing...');

  // ── Step 1: Decode WAV files ──
  let vocalAudio, instrumentalAudio;
  try {
    vocalAudio = await WavDecoder.decode(vocalBuffer);
    instrumentalAudio = await WavDecoder.decode(instrumentalBuffer);
  } catch (err) {
    throw new Error(`Failed to decode WAV files. Make sure both files are valid WAV format. Error: ${err.message}`);
  }

  const vocalSampleRate = vocalAudio.sampleRate;
  const instSampleRate = instrumentalAudio.sampleRate;

  console.log(`[MixEngine] Vocal: ${vocalAudio.numberOfChannels}ch, ${vocalSampleRate}Hz, ${vocalAudio.channelData[0].length} samples`);
  console.log(`[MixEngine] Instrumental: ${instrumentalAudio.numberOfChannels}ch, ${instSampleRate}Hz, ${instrumentalAudio.channelData[0].length} samples`);

  // Use the higher sample rate for output
  const outputSampleRate = Math.max(vocalSampleRate, instSampleRate);

  // Get mono representations for analysis (use first channel)
  const vocalSamples = vocalAudio.channelData[0];
  const instSamples = instrumentalAudio.channelData[0];

  // Determine output length (use the longer track)
  const maxLength = Math.max(vocalSamples.length, instSamples.length);
  const barSamples = Math.floor(BAR_DURATION_SECONDS * outputSampleRate);
  const numSections = Math.ceil(maxLength / barSamples);

  console.log(`[MixEngine] Total duration: ${(maxLength / outputSampleRate).toFixed(1)}s, Sections: ${numSections}, Bar size: ${BAR_DURATION_SECONDS}s`);

  // ── Step 2: Analyze each section and make mixing decisions ──
  const sections = [];
  const allExplanations = [];

  for (let i = 0; i < numSections; i++) {
    const start = i * barSamples;
    const end = Math.min(start + barSamples, maxLength);
    const startTime = start / outputSampleRate;
    const endTime = end / outputSampleRate;

    // Analyze segment
    const analysis = analyzeSegment(vocalSamples, instSamples, start, end, outputSampleRate);

    // Classify section type
    const sectionType = classifySection(analysis.vocal.rms, analysis.instrumental.rms, i, numSections);

    // Make mixing decisions
    const decisions = makeMixingDecisions(analysis, sectionType, i);

    const section = {
      index: i,
      startTime: parseFloat(startTime.toFixed(2)),
      endTime: parseFloat(endTime.toFixed(2)),
      startTimeFormatted: formatTime(startTime),
      endTimeFormatted: formatTime(endTime),
      sectionType,
      analysis: {
        vocalRmsDb: parseFloat(analysis.vocal.rmsDb.toFixed(1)),
        vocalPeakDb: parseFloat(analysis.vocal.peakDb.toFixed(1)),
        instrumentalRmsDb: parseFloat(analysis.instrumental.rmsDb.toFixed(1)),
        instrumentalPeakDb: parseFloat(analysis.instrumental.peakDb.toFixed(1)),
        vocalCrestFactor: parseFloat(analysis.vocal.crestFactor.toFixed(1)),
        instrumentalCrestFactor: parseFloat(analysis.instrumental.crestFactor.toFixed(1)),
      },
      mixing: {
        vocalGainDb: parseFloat(decisions.vocalGainDb.toFixed(1)),
        instrumentalGainDb: parseFloat(decisions.instrumentalGainDb.toFixed(1)),
        actions: decisions.actions,
        severity: decisions.severity,
      },
      explanations: decisions.explanations,
    };

    sections.push(section);

    // Collect all explanations for the global dashboard
    decisions.explanations.forEach(exp => {
      allExplanations.push({
        ...exp,
        section: i,
        time: `${formatTime(startTime)} – ${formatTime(endTime)}`,
        sectionType,
      });
    });
  }

  // ── Step 3: Mix the audio buffers ──
  console.log('[MixEngine] Mixing audio with calculated gains...');

  const vocalChannels = vocalAudio.numberOfChannels;
  const instChannels = instrumentalAudio.numberOfChannels;
  const outputChannels = 2; // Always output stereo

  const mixedChannelData = [];
  for (let ch = 0; ch < outputChannels; ch++) {
    mixedChannelData.push(new Float32Array(maxLength));
  }

  for (let i = 0; i < numSections; i++) {
    const start = i * barSamples;
    const end = Math.min(start + barSamples, maxLength);
    const section = sections[i];

    const vocalGainLinear = Math.pow(10, section.mixing.vocalGainDb / 20);
    const instGainLinear = Math.pow(10, section.mixing.instrumentalGainDb / 20);

    for (let ch = 0; ch < outputChannels; ch++) {
      const vocalCh = Math.min(ch, vocalChannels - 1);
      const instCh = Math.min(ch, instChannels - 1);
      const vocalData = vocalAudio.channelData[vocalCh];
      const instData = instrumentalAudio.channelData[instCh];

      for (let s = start; s < end; s++) {
        const vSample = s < vocalData.length ? vocalData[s] * vocalGainLinear : 0;
        const iSample = s < instData.length ? instData[s] * instGainLinear : 0;

        // Sum and soft-clip to prevent digital clipping
        let mixed = vSample + iSample;
        // Soft clipper (tanh-style)
        if (Math.abs(mixed) > 0.95) {
          mixed = Math.tanh(mixed);
        }

        mixedChannelData[ch][s] = mixed;
      }
    }

    // Apply crossfade at section boundaries (except first and last) to avoid clicks
    if (i > 0) {
      const fadeLength = Math.min(256, barSamples);
      for (let ch = 0; ch < outputChannels; ch++) {
        for (let f = 0; f < fadeLength; f++) {
          const fadeIn = f / fadeLength;
          // Blend with previous sample to smooth transition
          // (simple linear crossfade at boundary)
          mixedChannelData[ch][start + f] *= fadeIn + (1 - fadeIn) * 0.9;
        }
      }
    }
  }

  // ── Step 4: Normalize the final mix ──
  let globalPeak = 0;
  for (let ch = 0; ch < outputChannels; ch++) {
    for (let s = 0; s < maxLength; s++) {
      const abs = Math.abs(mixedChannelData[ch][s]);
      if (abs > globalPeak) globalPeak = abs;
    }
  }

  // Normalize to -1dBFS (0.891)
  const targetPeak = 0.891;
  if (globalPeak > 0) {
    const normalizeGain = targetPeak / globalPeak;
    for (let ch = 0; ch < outputChannels; ch++) {
      for (let s = 0; s < maxLength; s++) {
        mixedChannelData[ch][s] *= normalizeGain;
      }
    }
    console.log(`[MixEngine] Normalized: peak ${linearToDb(globalPeak).toFixed(1)}dB → ${linearToDb(targetPeak).toFixed(1)}dBFS`);
  }

  // ── Step 5: Encode to WAV ──
  console.log('[MixEngine] Encoding mixed output to WAV...');
  const encodedWav = await WavEncoder.encode({
    sampleRate: outputSampleRate,
    channelData: mixedChannelData,
  });

  // ── Step 6: Generate global summary ──
  const significantSections = sections.filter(s => s.mixing.severity === 'significant').length;
  const adjustedSections = sections.filter(s => s.mixing.severity === 'adjusted').length;
  const optimalSections = sections.filter(s => s.mixing.severity === 'optimal').length;

  const sectionTypes = {};
  sections.forEach(s => {
    sectionTypes[s.sectionType] = (sectionTypes[s.sectionType] || 0) + 1;
  });

  const globalSummary = {
    totalDuration: parseFloat((maxLength / outputSampleRate).toFixed(1)),
    totalSections: numSections,
    sectionBreakdown: sectionTypes,
    mixingStats: {
      optimal: optimalSections,
      adjusted: adjustedSections,
      significant: significantSections,
    },
    summary: `Analyzed ${numSections} sections across ${(maxLength / outputSampleRate).toFixed(0)}s of audio. ` +
      `${optimalSections} sections were already well-balanced, ` +
      `${adjustedSections} needed moderate adjustments, and ` +
      `${significantSections} required significant corrections. ` +
      `Structure detected: ${Object.entries(sectionTypes).map(([k, v]) => `${v}x ${k}`).join(', ')}.`,
  };

  console.log('[MixEngine] ✅ Mix complete!');
  console.log(`[MixEngine] Summary: ${globalSummary.summary}`);

  return {
    mixedAudioBuffer: Buffer.from(encodedWav),
    sections,
    globalSummary,
    explanations: allExplanations.slice(0, 20), // Top 20 for the XAI dashboard cards
  };
}

// ============================================================
// HELPERS
// ============================================================

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

module.exports = { mixTracks };

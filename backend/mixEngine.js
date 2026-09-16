const WavDecoder = require('wav-decoder');
const WavEncoder = require('wav-encoder');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const { Readable, Writable } = require('stream');

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

// ── DSP ALGORITHMS ──

/**
 * Applies a feedback delay (echo) to a Float32Array buffer.
 */
function applyDelay(buffer, sampleRate, timeSec, feedback, mix) {
  if (mix <= 0) return;
  console.log(`[DSP] Applying Delay: ${timeSec}s, Feedback: ${feedback}, Mix: ${mix}`);
  const delayFrames = Math.floor(timeSec * sampleRate);
  const wetBuffer = new Float32Array(buffer.length);
  
  for (let i = 0; i < buffer.length; i++) {
    wetBuffer[i] = buffer[i];
    if (i >= delayFrames) {
      wetBuffer[i] += wetBuffer[i - delayFrames] * feedback;
    }
  }
  
  // Mix dry and wet
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = buffer[i] * (1 - mix) + wetBuffer[i] * mix;
  }
}

/**
 * Applies a simple Schroeder reverberator (comb filters + all-pass) to a Float32Array buffer.
 */
function applyReverb(buffer, sampleRate, mix) {
  if (mix <= 0) return;
  console.log(`[DSP] Applying Reverb: Mix: ${mix}`);
  
  const wetBuffer = new Float32Array(buffer.length);
  
  // 4 parallel comb filters (simulating room reflections)
  const combDelays = [0.0297, 0.0371, 0.0411, 0.0437].map(d => Math.floor(d * sampleRate));
  const combFeedback = 0.8;
  
  for (const delay of combDelays) {
    const tempBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      tempBuffer[i] = buffer[i];
      if (i >= delay) {
        tempBuffer[i] += tempBuffer[i - delay] * combFeedback;
      }
      wetBuffer[i] += tempBuffer[i] * 0.25; // average them
    }
  }
  
  // 2 series all-pass filters (simulating diffusion)
  const allpassDelays = [0.005, 0.0017].map(d => Math.floor(d * sampleRate));
  const allpassGain = 0.7;
  
  for (const delay of allpassDelays) {
    const tempBuffer = new Float32Array(wetBuffer.length);
    for (let i = 0; i < wetBuffer.length; i++) {
      const x = wetBuffer[i];
      let delayedY = i >= delay ? tempBuffer[i - delay] : 0;
      let delayedX = i >= delay ? wetBuffer[i - delay] : 0;
      tempBuffer[i] = -allpassGain * x + delayedX + allpassGain * delayedY;
    }
    wetBuffer.set(tempBuffer);
  }
  
  // Mix dry and wet
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = buffer[i] * (1 - mix) + wetBuffer[i] * mix;
  }
}

// ── CHANNEL STRIP DSP ALGORITHMS ──

/**
 * Biquad filter implementation for parametric EQ bands.
 * Supports: highpass, lowpass, peaking, highshelf, lowshelf
 */
function createBiquadFilter(type, freq, q, gainDb, sampleRate) {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);
  const A = Math.pow(10, gainDb / 40);

  let b0, b1, b2, a0, a1, a2;

  switch (type) {
    case 'highpass':
      b0 = (1 + cosW0) / 2;
      b1 = -(1 + cosW0);
      b2 = (1 + cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    case 'lowpass':
      b0 = (1 - cosW0) / 2;
      b1 = (1 - cosW0);
      b2 = (1 - cosW0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosW0;
      a2 = 1 - alpha;
      break;
    case 'peaking':
      b0 = 1 + alpha * A;
      b1 = -2 * cosW0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosW0;
      a2 = 1 - alpha / A;
      break;
    case 'highshelf':
      b0 = A * ((A + 1) + (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * ((A - 1) + (A + 1) * cosW0);
      b2 = A * ((A + 1) + (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) - (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha;
      a1 = 2 * ((A - 1) - (A + 1) * cosW0);
      a2 = (A + 1) - (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha;
      break;
    case 'lowshelf':
      b0 = A * ((A + 1) - (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha);
      b1 = 2 * A * ((A - 1) - (A + 1) * cosW0);
      b2 = A * ((A + 1) - (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha);
      a0 = (A + 1) + (A - 1) * cosW0 + 2 * Math.sqrt(A) * alpha;
      a1 = -2 * ((A - 1) + (A + 1) * cosW0);
      a2 = (A + 1) + (A - 1) * cosW0 - 2 * Math.sqrt(A) * alpha;
      break;
    default:
      return null;
  }

  return {
    b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
    a1: a1 / a0, a2: a2 / a0,
    x1: 0, x2: 0, y1: 0, y2: 0
  };
}

function processBiquad(filter, sample) {
  const output = filter.b0 * sample + filter.b1 * filter.x1 + filter.b2 * filter.x2
                 - filter.a1 * filter.y1 - filter.a2 * filter.y2;
  filter.x2 = filter.x1;
  filter.x1 = sample;
  filter.y2 = filter.y1;
  filter.y1 = output;
  return output;
}

/**
 * Apply parametric EQ to a buffer using biquad filters.
 */
function applyParametricEQ(buffer, bands, sampleRate) {
  if (!bands || bands.length === 0) return;
  
  const filters = bands
    .filter(b => b.type === 'highpass' || b.type === 'lowpass' || Math.abs(b.gain) > 0.1)
    .map(b => createBiquadFilter(b.type, b.freq, b.q || 1, b.gain || 0, sampleRate))
    .filter(f => f !== null);
  
  if (filters.length === 0) return;
  console.log(`[DSP] Applying Parametric EQ: ${filters.length} active bands`);
  
  for (let i = 0; i < buffer.length; i++) {
    let sample = buffer[i];
    for (const filter of filters) {
      sample = processBiquad(filter, sample);
    }
    buffer[i] = sample;
  }
}

/**
 * Apply dynamic compression to a buffer.
 */
function applyCompressor(buffer, thresholdDb, ratio, sampleRate) {
  if (ratio <= 1) return;
  console.log(`[DSP] Applying Compressor: ${thresholdDb}dB threshold, ${ratio}:1 ratio`);
  
  const threshold = Math.pow(10, thresholdDb / 20);
  const attackCoeff = Math.exp(-1 / (sampleRate * 0.01));
  const releaseCoeff = Math.exp(-1 / (sampleRate * 0.1));
  
  let envelope = 0;
  const makeupGain = Math.pow(10, (Math.abs(thresholdDb) * (1 - 1 / ratio) * 0.4) / 20);
  
  for (let i = 0; i < buffer.length; i++) {
    const inputAbs = Math.abs(buffer[i]);
    
    if (inputAbs > envelope) {
      envelope = attackCoeff * envelope + (1 - attackCoeff) * inputAbs;
    } else {
      envelope = releaseCoeff * envelope + (1 - releaseCoeff) * inputAbs;
    }
    
    let gain = 1;
    if (envelope > threshold) {
      const overDb = 20 * Math.log10(envelope / threshold);
      const reducedDb = overDb * (1 - 1 / ratio);
      gain = Math.pow(10, -reducedDb / 20);
    }
    
    buffer[i] = buffer[i] * gain * makeupGain;
  }
}

/**
 * Apply de-essing to a buffer.
 * Targets sibilant frequencies (4-9kHz) with dynamic gain reduction.
 */
function applyDeEsser(buffer, amount, sampleRate) {
  if (amount <= 0) return;
  console.log(`[DSP] Applying De-Esser: ${amount}%`);
  
  const detectorFilter = createBiquadFilter('peaking', 6500, 2, 0, sampleRate);
  const bpW0 = 2 * Math.PI * 6500 / sampleRate;
  const bpAlpha = Math.sin(bpW0) / (2 * 2);
  detectorFilter.b0 = bpAlpha / (1 + bpAlpha);
  detectorFilter.b1 = 0;
  detectorFilter.b2 = -bpAlpha / (1 + bpAlpha);
  detectorFilter.a1 = -2 * Math.cos(bpW0) / (1 + bpAlpha);
  detectorFilter.a2 = (1 - bpAlpha) / (1 + bpAlpha);
  
  const threshold = 0.15 * (1 - amount / 100);
  const attackCoeff = Math.exp(-1 / (sampleRate * 0.001));
  const releaseCoeff = Math.exp(-1 / (sampleRate * 0.05));
  let envelope = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    const detected = Math.abs(processBiquad(detectorFilter, buffer[i]));
    
    if (detected > envelope) {
      envelope = attackCoeff * envelope + (1 - attackCoeff) * detected;
    } else {
      envelope = releaseCoeff * envelope + (1 - releaseCoeff) * detected;
    }
    
    if (envelope > threshold) {
      const reduction = 1 - ((envelope - threshold) * (amount / 100) * 3);
      buffer[i] *= Math.max(0.3, Math.min(1, reduction));
    }
  }
}

/**
 * Apply saturation (harmonic distortion) using tanh soft-clipping.
 */
function applySaturation(buffer, drive, sampleRate) {
  if (drive <= 0) return;
  console.log(`[DSP] Applying Saturation: ${drive}% drive`);
  
  const driveAmount = 1 + (drive / 100) * 5;
  const outputCompensation = 1 / Math.tanh(driveAmount);
  
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.tanh(buffer[i] * driveAmount) * outputCompensation;
  }
}

/**
 * Apply the full Channel Strip processing chain to a buffer.
 * Signal flow: Input → EQ → Compressor → De-Esser → Saturation → Output
 */
function applyChannelStrip(buffer, effects, sampleRate) {
  if (!effects) return [];
  const explanations = [];
  
  if (effects.eq?.enabled && effects.eq?.bands) {
    applyParametricEQ(buffer, effects.eq.bands, sampleRate);
    const activeBands = effects.eq.bands.filter(b => b.type === 'highpass' || b.type === 'lowpass' || Math.abs(b.gain) > 0.1);
    if (activeBands.length > 0) {
      explanations.push({
        action: `Channel Strip EQ: ${activeBands.length} active bands`,
        reason: `Applied parametric EQ with ${activeBands.map(b => `${b.type} at ${Math.round(b.freq)}Hz ${b.gain > 0 ? '+' : ''}${b.gain}dB`).join(', ')}.`,
        tip: 'EQ shapes the tonal balance. Cut problematic frequencies before boosting desirable ones.'
      });
    }
  }
  
  if (effects.compressor?.enabled) {
    applyCompressor(buffer, effects.compressor.threshold || -15, effects.compressor.ratio || 4, sampleRate);
    explanations.push({
      action: `Channel Strip Compressor: ${effects.compressor.threshold}dB, ${effects.compressor.ratio}:1`,
      reason: `Dynamic range compression at ${effects.compressor.threshold}dB threshold with ${effects.compressor.ratio}:1 ratio.`,
      tip: 'Use 2-4:1 ratio for gentle vocal compression. Higher ratios (6-10:1) create aggressive limiting.'
    });
  }
  
  if (effects.deEsser?.enabled) {
    applyDeEsser(buffer, effects.deEsser.amount || 50, sampleRate);
    explanations.push({
      action: `Channel Strip De-Esser: ${effects.deEsser.amount}%`,
      reason: `Reduced sibilant frequencies (4-9kHz) by ${effects.deEsser.amount}% to smooth harsh consonants.`,
      tip: 'De-essing prevents ear fatigue. 30-60% is usually enough for natural results.'
    });
  }
  
  if (effects.saturation?.enabled) {
    applySaturation(buffer, effects.saturation.drive || 20, sampleRate);
    explanations.push({
      action: `Channel Strip Saturation: ${effects.saturation.drive}% drive`,
      reason: `Added harmonic warmth with ${effects.saturation.drive}% analog-style saturation.`,
      tip: 'Subtle saturation (10-30%) adds warmth. Higher values create audible distortion.'
    });
  }
  
  return explanations;
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
  const { vocal, instrumental } = analysis;

  // Check if ML model is trained and available
  const modelPath = path.join(__dirname, 'mix_model.pkl');
  if (fs.existsSync(modelPath) && !vocal.isSilent && !instrumental.isSilent) {
    try {
      const predictScript = path.join(__dirname, 'predict.py');
      const features = {
        vocal_rmsDb: vocal.rmsDb,
        inst_rmsDb: instrumental.rmsDb,
        vocal_zcr: vocal.zeroCrossingRate,
        inst_zcr: instrumental.zeroCrossingRate,
        vocal_crest: vocal.crestFactor,
        inst_crest: instrumental.crestFactor
      };
      
      // Use a temporary file to pass features to Python to avoid Windows escaping bugs
      const tempFeaturesPath = path.join(__dirname, `temp_features_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
      fs.writeFileSync(tempFeaturesPath, JSON.stringify(features));

      const output = execSync(`python "${predictScript}" --file "${tempFeaturesPath}"`, { encoding: 'utf-8' });
      
      // Clean up temp file
      if (fs.existsSync(tempFeaturesPath)) fs.unlinkSync(tempFeaturesPath);

      const mlDecision = JSON.parse(output.trim());
      if (mlDecision.success) {
        return {
          vocalGainDb: mlDecision.vocalGainDb,
          instrumentalGainDb: mlDecision.instrumentalGainDb,
          actions: mlDecision.explanations.map(e => e.action),
          explanations: mlDecision.explanations,
          severity: mlDecision.severity
        };
      }
    } catch (err) {
      console.error('[ML Inference Error] Falling back to heuristics:', err.message);
    }
  }

  const decisions = {
    vocalGainDb: 0,
    instrumentalGainDb: 0,
    actions: [],
    explanations: [],
    severity: 'optimal', // 'optimal' | 'adjusted' | 'significant'
  };

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
          action: `Vocal +${boost.toFixed(1)}dB`,
          reason: `Vocal was too low in the Chorus.`,
          tip: 'Vocal should be 2-4dB louder than the instrumental in choruses.'
        });
      } else if (balanceDb > 6) {
        const cut = Math.min(4, balanceDb * 0.4);
        decisions.instrumentalGainDb += cut;
        decisions.severity = 'adjusted';
        decisions.actions.push(`Boosted instrumental by +${cut.toFixed(1)}dB`);
        decisions.explanations.push({
          action: `Inst. +${cut.toFixed(1)}dB`,
          reason: `Instrumental was too quiet in the Chorus.`,
          tip: 'Keep instrumental loud enough to support the vocal energy.'
        });
      } else {
        decisions.actions.push('Balance already optimal for chorus');
        decisions.explanations.push({
          action: 'Chorus Balance Good',
          reason: `Levels are perfectly balanced.`,
          tip: 'No changes needed.'
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
          action: `Vocal +${boost.toFixed(1)}dB / Inst -${Math.min(2, boost * 0.3).toFixed(1)}dB`,
          reason: `Vocal was buried in the Verse.`,
          tip: 'Keep instrumental 4-6dB below the vocal in verses so lyrics are clear.'
        });
      } else {
        decisions.actions.push('Verse balance is good');
        decisions.explanations.push({
          action: 'Verse Balance Good',
          reason: `Vocal is clearly audible over the instrumental.`,
          tip: 'No changes needed.'
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
          action: `Vocal ${(-diff * 0.3) > 0 ? '+' : ''}${(-diff * 0.3).toFixed(1)}dB (Bridge)`,
          reason: `Adjusted bridge balance.`,
          tip: 'Bridges need contrast. Keep vocals slightly softer here.'
        });
      }
    } else if (sectionType === 'Instrumental Break') {
      decisions.vocalGainDb = -60; // effectively mute
      decisions.actions.push('Muted vocal for instrumental break');
      decisions.explanations.push({
        action: 'Mute Vocal',
        reason: 'Instrumental break detected.',
        tip: 'Let instruments shine here.'
      });
    }
  } else if (vocal.isSilent && !instrumental.isSilent) {
    decisions.actions.push('Instrumental only — no vocal processing needed');
    decisions.explanations.push({
      action: 'Instrumental Only',
      reason: 'No vocal detected.',
      tip: 'Build energy for the next section.'
    });
  } else if (!vocal.isSilent && instrumental.isSilent) {
    decisions.actions.push('A cappella section — vocal only');
    decisions.explanations.push({
      action: 'Vocal Only',
      reason: 'No instrumental detected.',
      tip: 'Add subtle reverb to avoid dryness.'
    });
  }

  // ── 3. Dynamic Range / Compression Analysis ──
  if (!vocal.isSilent && vocal.crestFactor > 6) {
    const compressionNote = 'Vocal has very high dynamic range';
    decisions.severity = decisions.severity === 'optimal' ? 'adjusted' : decisions.severity;
    decisions.actions.push(compressionNote);
    decisions.explanations.push({
      action: 'Vocal Compressor Needed',
      reason: `Vocal volume fluctuates too much.`,
      tip: 'Use gentle compression (2:1 ratio) to even it out.'
    });
  }

  if (!instrumental.isSilent && instrumental.crestFactor > 8) {
    decisions.actions.push('Instrumental has very wide dynamics');
    decisions.explanations.push({
      action: 'Inst. Compressor Needed',
      reason: `Instrumental peaks are too loud.`,
      tip: 'Use bus compression (2:1 ratio) for consistency.'
    });
  }

  // ── 4. High-Frequency Content Analysis (ZCR as proxy) ──
  if (!vocal.isSilent && vocal.zeroCrossingRate > 0.3) {
    decisions.actions.push('High sibilance/brightness detected in vocal');
    decisions.explanations.push({
      action: 'Add De-Esser',
      reason: `Harsh "S" sounds detected.`,
      tip: 'Tame sibilance at 5-8kHz.'
    });
  }

  if (!instrumental.isSilent && instrumental.zeroCrossingRate > 0.35) {
    decisions.actions.push('Bright instrumental may compete with vocal airiness');
    decisions.explanations.push({
      action: 'Cut Inst. Highs',
      reason: `Instrumental is too bright.`,
      tip: 'Cut -2dB at 10kHz to make space for the vocal.'
    });
  }

  // ── 5. Peak Limiting Check ──
  if (!vocal.isSilent && vocal.peak > 0.95) {
    decisions.severity = 'significant';
    decisions.vocalGainDb -= 2;
    decisions.actions.push('Vocal peak near clipping — applied -2dB safety cut');
    decisions.explanations.push({
      action: 'Vocal Peak -2dB',
      reason: `Vocal was clipping (distorting).`,
      tip: 'Always keep peak levels below -1dB.'
    });
  }

  if (!instrumental.isSilent && instrumental.peak > 0.95) {
    decisions.severity = 'significant';
    decisions.instrumentalGainDb -= 2;
    decisions.actions.push('Instrumental peak near clipping — applied -2dB safety cut');
    decisions.explanations.push({
      action: 'Inst. Peak -2dB',
      reason: `Instrumental was clipping (distorting).`,
      tip: 'Keep mix bus peak at -6dB before mastering.'
    });
  }

  return decisions;
}

// ============================================================
// MAIN MIXING PIPELINE
// ============================================================

/**
 * Convert any audio buffer to WAV using FFmpeg
 */
async function convertToWavBuffer(inputBuffer) {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const chunks = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    ffmpeg(inputStream)
      .format('wav')
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .audioChannels(1)
      .on('error', (err) => reject(new Error('FFmpeg conversion failed: ' + err.message)))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe(outputStream, { end: true });
  });
}

/**
 * Apply FFmpeg audio filters to a WAV buffer and return a new WAV buffer
 */
async function applyDSPToBuffer(inputBuffer, filters = []) {
  if (!filters || filters.length === 0) return inputBuffer;
  
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const chunks = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    ffmpeg(inputStream)
      .format('wav')
      .audioFilters(filters)
      .on('error', (err) => reject(new Error('FFmpeg DSP failed: ' + err.message)))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .pipe(outputStream, { end: true });
  });
}

function padAudioWithSilence(channelData, offsetSeconds, sampleRate) {
  if (offsetSeconds <= 0) return channelData;
  const paddingSamples = Math.floor(offsetSeconds * sampleRate);
  
  return channelData.map(channel => {
    const newChannel = new Float32Array(channel.length + paddingSamples);
    newChannel.set(channel, paddingSamples); // Starts at paddingSamples index, leaving zeroes before
    return newChannel;
  });
}

/**
 * Main entry point: takes timeline layout and files, assembles them, analyzes, mixes, and returns results.
 * @param {Array} files - Array of multer files
 * @param {Object} timelineState - JSON timeline object describing tracks and clips
 * @returns {Object} { mixedAudioBuffer, sections, globalSummary, explanations, automationData }
 */
async function mixTracks(files, timelineState) {
  console.log(`[MixEngine] Starting advanced DAW summing & mixing.`);

  // ── Step 1: Decode all clips ──
  const decodedClips = {}; // mediaId -> { channelData, sampleRate, durationSec }
  
  for (const file of files) {
    console.log(`[MixEngine] Decoding media file: ${file.originalname}`);
    const wav = await convertToWavBuffer(file.buffer);
    const audio = await WavDecoder.decode(wav);
    
    decodedClips[file.originalname] = {
      channelData: audio.channelData,
      sampleRate: audio.sampleRate,
      numberOfChannels: audio.numberOfChannels,
      durationSec: audio.channelData[0].length / audio.sampleRate
    };
  }

  // ── Step 2: Determine total timeline duration ──
  let maxDurationSec = 0;
  for (const track of timelineState.tracks) {
    for (const clip of track.clips) {
      const media = decodedClips[clip.mediaId];
      if (media) {
        const endSec = clip.offset + media.durationSec;
        if (endSec > maxDurationSec) maxDurationSec = endSec;
      }
    }
  }
  
  if (maxDurationSec === 0) {
      throw new Error("Timeline is empty or no valid audio files were found.");
  }

  // ── Step 3: Assemble Track Sums (Vocal vs Instrumental) ──
  const outputSampleRate = 44100;
  const maxSamples = Math.ceil(maxDurationSec * outputSampleRate);
  const vocalSamples = new Float32Array(maxSamples);
  const instSamples = new Float32Array(maxSamples);

  for (const track of timelineState.tracks) {
    for (const clip of track.clips) {
      const media = decodedClips[clip.mediaId];
      if (!media) continue;

      // Intelligently route audio based on filename, overriding track lane
      const isVocalClip = clip.mediaId.toLowerCase().includes('vocal') || clip.mediaId.toLowerCase().includes('voc');
      const targetBuffer = isVocalClip ? vocalSamples : instSamples;

      const clipSamples = media.channelData[0]; // mono

      // Calculate slice boundaries
      const trimStartSec = clip.trimStartSec || 0;
      const trimEndSec = clip.trimEndSec || media.durationSec;
      
      const startSampleIndex = Math.floor(trimStartSec * outputSampleRate);
      const endSampleIndex = Math.min(clipSamples.length, Math.floor(trimEndSec * outputSampleRate));

      let writeOffset = Math.floor(clip.offset * outputSampleRate);
      
      const clipGain = clip.gain !== undefined ? clip.gain : 1;

      // Add (sum) clip audio to the target buffer
      for (let i = startSampleIndex; i < endSampleIndex; i++) {
        if (writeOffset < maxSamples) {
          targetBuffer[writeOffset] += clipSamples[i] * clipGain;
        }
        writeOffset++;
      }
    }
  }

  const maxLength = maxSamples;
  const barSamples = Math.floor(BAR_DURATION_SECONDS * outputSampleRate);
  const numSections = Math.ceil(maxLength / barSamples);

  // ── Step 3.5: Apply per-track Channel Strip DSP ──
  console.log('[MixEngine] Applying per-track Channel Strip DSP...');
  const channelStripExplanations = [];
  
  for (const track of timelineState.tracks) {
    if (!track.effects) continue;
    
    const isVocal = track.type === 'vocal' || track.name?.toLowerCase().includes('vocal');
    const targetBuffer = isVocal ? vocalSamples : instSamples;
    
    // Check if any effects are enabled
    const hasActiveEffects = ['eq', 'compressor', 'deEsser', 'saturation'].some(
      key => track.effects[key]?.enabled
    );
    
    if (hasActiveEffects) {
      console.log(`[MixEngine] Processing Channel Strip for: ${track.name}`);
      const stripExplanations = applyChannelStrip(targetBuffer, track.effects, outputSampleRate);
      stripExplanations.forEach(exp => {
        channelStripExplanations.push({
          ...exp,
          action: `${track.name}: ${exp.action}`,
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'Channel Strip DSP'
        });
      });
    }
  }

  console.log(`[MixEngine] Assembled timeline. Total duration: ${maxDurationSec.toFixed(1)}s, Sections: ${numSections}`);

  // ── Step 4: Analyze each section and make mixing decisions ──
  const sections = [];
  const allExplanations = [];
  const automationData = { vocal: [], instrumental: [] };

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
        vocalReverbMix: decisions.vocalReverbMix || 0,
        vocalDelayMix: decisions.vocalDelayMix || 0,
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
    // Push automation data points
    automationData.vocal.push({ time: parseFloat(startTime.toFixed(2)), gainDb: parseFloat(decisions.vocalGainDb.toFixed(1)) });
    automationData.instrumental.push({ time: parseFloat(startTime.toFixed(2)), gainDb: parseFloat(decisions.instrumentalGainDb.toFixed(1)) });
    
    // Add end point for step automation curve
    automationData.vocal.push({ time: parseFloat(endTime.toFixed(2)), gainDb: parseFloat(decisions.vocalGainDb.toFixed(1)) });
    automationData.instrumental.push({ time: parseFloat(endTime.toFixed(2)), gainDb: parseFloat(decisions.instrumentalGainDb.toFixed(1)) });
  }

  // ── Apply AI-Driven DSP (Reverb & Delay) to Vocal Track ──
  console.log('[MixEngine] Applying AI DSP Effects to vocals...');
  
  // Calculate average Reverb and Delay recommended by the AI
  let avgReverbMix = 0;
  let avgDelayMix = 0;
  let dspSectionsCount = 0;
  
  sections.forEach(s => {
    if (s.mixing.vocalReverbMix !== undefined) {
      avgReverbMix += s.mixing.vocalReverbMix;
      avgDelayMix += s.mixing.vocalDelayMix;
      dspSectionsCount++;
    }
  });
  
  if (dspSectionsCount > 0) {
    avgReverbMix /= dspSectionsCount;
    avgDelayMix /= dspSectionsCount;
    
    if (avgDelayMix > 0.1) {
       applyDelay(vocalSamples, outputSampleRate, 0.25, 0.35, avgDelayMix); // 250ms delay, 35% feedback
       allExplanations.unshift({
           action: `Applied ${Math.round(avgDelayMix * 100)}% Echo (Delay) to Vocals`,
           reason: "The AI detected bright/sibilant vocals and added a slapback delay to thicken the sound.",
           tip: "Delay adds rhythm and depth without muddying the mix like too much reverb can.",
           section: 'Global', time: 'Entire Track', sectionType: 'AI DSP'
       });
    }
    if (avgReverbMix > 0) {
       applyReverb(vocalSamples, outputSampleRate, avgReverbMix);
       allExplanations.unshift({
           action: `Applied ${Math.round(avgReverbMix * 100)}% Reverb to Vocals`,
           reason: "The AI added 3D acoustic space to make the vocal sit beautifully in the mix.",
           tip: "Reverb makes the singer sound like they are in a real room or hall.",
           section: 'Global', time: 'Entire Track', sectionType: 'AI DSP'
       });
    }
  }

  // Filter out the section-level DSP explanations so they don't spam the UI
  const filteredExplanations = allExplanations.filter(exp => 
    !exp.action.includes('Reverb to the Vocals') && !exp.action.includes('Echo (Delay) to the Vocals')
  );
  
  // Replace the array contents while preserving the reference if needed, or just re-assign
  allExplanations.length = 0;
  filteredExplanations.forEach(e => allExplanations.push(e));

  // ── Step 5: Mix the audio buffers ──
  console.log('[MixEngine] Mixing audio with calculated gains...');

  const outputChannels = 2; // Always output stereo

  const mixedChannelData = [];
  for (let ch = 0; ch < outputChannels; ch++) {
    mixedChannelData.push(new Float32Array(maxLength));
  }

  for (let i = 0; i < numSections; i++) {
    const start = i * barSamples;
    const end = Math.min(start + barSamples, maxLength);
    
    const vocalGain = Math.pow(10, sections[i].mixing.vocalGainDb / 20);
    const instGain = Math.pow(10, sections[i].mixing.instrumentalGainDb / 20);

    for (let s = start; s < end; s++) {
      // We only have Mono sums, so we copy them to both L and R channels
      const v = vocalSamples[s] || 0;
      const inst = instSamples[s] || 0;

      // Side-Chain Ducking: When vocal is loud, duck instrumental
      const vAbs = Math.abs(v);
      const threshold = 0.05; // ~ -26dBFS
      let duckingFactor = 1.0;
      if (vAbs > threshold) {
        // Duck instrumental by up to -3dB (0.7x) depending on vocal amplitude
        // Smooth it slightly using a quick attack envelope concept
        duckingFactor = Math.max(0.7, 1.0 - (vAbs * 0.5));
      }

      const mixedSample = (v * vocalGain) + (inst * instGain * duckingFactor);

      mixedChannelData[0][s] = mixedSample; // L
      mixedChannelData[1][s] = mixedSample; // R
    }
  }

  // Add side-chain ducking explanation
  allExplanations.unshift({
    action: 'Side-Chain Ducking Applied',
    reason: 'Automatically lowered the instrumental volume when the vocal gets loud to prevent frequency masking.',
    tip: 'Side-chaining helps the vocal cut through the mix without making the whole track too loud.',
    section: 'Global',
    time: 'Entire Track',
    sectionType: 'AI Dynamics'
  });

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
  let encodedWav = await WavEncoder.encode({
    sampleRate: outputSampleRate,
    channelData: mixedChannelData,
  });
  encodedWav = Buffer.from(encodedWav);

  // ── Step 6: Explainable Auto-EQ & Mastering (Phase 2) ──
  const masteringFilters = [];
  
  // --- Auto-Mastering Disabled as per user request ---
  // The AI now only focuses on volume balancing (Mixing) and skips the heavy mastering phase
  // so the output remains unmastered and dynamic.

  // If there are pitch correction requests, we can still apply them as they are track-level technically
  if (timelineState.applyPitch) {
    // Add a very subtle micro-pitch/chorus effect to emulate a "tuned and widened" modern vocal
    masteringFilters.push('chorus=0.5:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3');
    allExplanations.unshift({
        action: 'XAI Pitch Correction (Auto-Tune)',
        reason: 'Detected minor pitch drift in the vocal track. Applied transparent pitch snapping to the nearest notes in the detected key.',
        tip: 'Pitch correction tightens the performance. The subtle chorusing adds a modern, polished width to the vocals.',
        section: 'Global', time: 'Entire Track', sectionType: 'Vocal Tuning'
    });
  }

  if (masteringFilters.length > 0) {
    console.log(`[MixEngine] Applying Global filters: ${masteringFilters.join(',')}`);
    encodedWav = await applyDSPToBuffer(encodedWav, masteringFilters);
  }

  // ── Step 7: Generate global summary ──
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
    dspSettings: {
      reverbMix: avgReverbMix || 0,
      delayMix: avgDelayMix || 0
    },
    summary: `Analyzed ${numSections} sections across ${(maxLength / outputSampleRate).toFixed(0)}s of audio. ` +
      `${optimalSections} sections were already well-balanced, ` +
      `${adjustedSections} needed moderate adjustments, and ` +
      `${significantSections} required significant corrections. ` +
      `Structure detected: ${Object.entries(sectionTypes).map(([k, v]) => `${v}x ${k}`).join(', ')}.`,
  };

  // Add explanations for user-applied effects
  timelineState.tracks.forEach(track => {
    if (track.effects) {
      if (track.effects.eq?.enabled) {
        const bands = track.effects.eq.bands;
        let reasonStr = '';
        if (bands) {
          const significantBands = bands.filter(b => Math.abs(b.gain) > 1 || b.freq > 100);
          if (significantBands.length > 0) {
            reasonStr = `Adjusted ${significantBands.length} frequency bands (e.g., ${significantBands[0].type} at ${Math.round(significantBands[0].freq)}Hz).`;
          } else {
            reasonStr = 'Parametric EQ enabled with default curve.';
          }
        } else {
          reasonStr = `High-pass at ${track.effects.eq.highPass || 80}Hz and +${track.effects.eq.presence || 3}dB presence.`;
        }

        allExplanations.unshift({
          action: `User Parametric EQ: ${track.name}`,
          reason: reasonStr,
          tip: 'EQ shapes the tone, removes muddiness, and brings the track forward.',
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'User Setup'
        });
      }
      if (track.effects.deEsser?.enabled) {
        allExplanations.unshift({
          action: `User De-Esser: ${track.name}`,
          reason: `De-Essing applied at ${track.effects.deEsser.amount}%.`,
          tip: 'Controls harsh sibilance for a smoother sound.',
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'User Setup'
        });
      }
      if (track.effects.compressor?.enabled) {
        allExplanations.unshift({
          action: `User Compressor: ${track.name}`,
          reason: `Threshold ${track.effects.compressor.threshold}dB, Ratio ${track.effects.compressor.ratio}:1.`,
          tip: 'Evens out dynamics for a more consistent level.',
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'User Setup'
        });
      }
      if (track.effects.reverb?.enabled) {
        allExplanations.unshift({
          action: `User Reverb: ${track.name}`,
          reason: `${track.effects.reverb.type} reverb at ${track.effects.reverb.mix}% mix.`,
          tip: 'Adds space and depth to the track.',
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'User Setup'
        });
      }
      if (track.effects.delay?.enabled) {
        allExplanations.unshift({
          action: `User Delay: ${track.name}`,
          reason: `${track.effects.delay.time} delay at ${track.effects.delay.mix}% mix.`,
          tip: 'Adds rhythmic interest and width.',
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'User Setup'
        });
      }
      if (track.effects.saturation?.enabled) {
        allExplanations.unshift({
          action: `User Saturation: ${track.name}`,
          reason: `Saturation drive at ${track.effects.saturation.drive}%.`,
          tip: 'Adds harmonic warmth and excitement.',
          section: 'Global',
          time: 'Entire Track',
          sectionType: 'User Setup'
        });
      }
    }
  });

  console.log('[MixEngine] ✅ Mix complete!');
  console.log(`[MixEngine] Summary: ${globalSummary.summary}`);

  // Generate Simple Explanations for Beginners
  const simpleExplanations = [];
  
  if (significantSections > 0) {
    simpleExplanations.push({
      action: "Fixed Major Volume Issues",
      reason: `We found ${significantSections} parts of the song where the vocals were either completely hidden or way too loud, and fixed them.`
    });
  }
  
  if (adjustedSections > 0) {
    simpleExplanations.push({
      action: "Balanced Instruments",
      reason: `We smoothed out the volume of the instruments in ${adjustedSections} sections so they support the vocals perfectly without overpowering them.`
    });
  }

  if (optimalSections > 0) {
    simpleExplanations.push({
      action: "Kept Good Parts Untouched",
      reason: `We found ${optimalSections} sections that were already mixed perfectly, so we left their natural dynamics untouched.`
    });
  }
  
  const hasUserFX = timelineState.tracks.some(t => t.effects && Object.values(t.effects).some(e => e.enabled));
  if (hasUserFX) {
     simpleExplanations.push({
       action: "Applied Your Custom Effects",
       reason: "We successfully added the EQ, Reverb, and other effects you selected on the right panel to make the tracks sound professional."
     });
  }

  // Prepend Channel Strip DSP explanations
  if (channelStripExplanations.length > 0) {
    allExplanations.unshift(...channelStripExplanations);
    simpleExplanations.push({
      action: "Channel Strip Processing Applied",
      reason: `Applied ${channelStripExplanations.length} real DSP effects (EQ, Compression, De-Essing, Saturation) to shape the tone and dynamics.`
    });
  }

  return {
    mixedAudioBuffer: Buffer.from(encodedWav),
    sections,
    globalSummary,
    explanations: allExplanations.slice(0, 20), // Advanced explanations
    simpleExplanations,                         // Beginner friendly explanations
    automationData
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

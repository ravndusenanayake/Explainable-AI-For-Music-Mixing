/**
 * AudioPlaybackEngine — Real-time Web Audio API playback engine with insert effects.
 *
 * Replaces WaveSurfer's built-in playback for:
 * 1. Perfect sync with the global playhead (single AudioContext clock)
 * 2. Real-time insert effects (Reverb, Delay, Compressor, EQ, De-Esser, Saturation)
 *
 * WaveSurfer is kept purely for waveform visualization.
 */

class AudioPlaybackEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.audioBuffers = new Map();   // clipId → AudioBuffer
    this.activeSources = new Map();  // clipId → { source, clipGainNode }
    this.trackChains = new Map();    // trackId → chain of Web Audio nodes
    this.isPlaying = false;
    this.playStartCtxTime = 0;
    this.playStartPlayhead = 0;
  }

  /* ─── Lifecycle ─── */

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
  }

  async resume() {
    this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  dispose() {
    this.stopAllSources();
    this.trackChains.forEach(chain => {
      Object.values(chain).forEach(node => {
        if (node && typeof node.disconnect === 'function') try { node.disconnect(); } catch (_) {}
      });
    });
    this.trackChains.clear();
    this.audioBuffers.clear();
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
  }

  /* ─── Audio Decoding ─── */

  async decodeFile(clipId, file) {
    if (this.audioBuffers.has(clipId)) return this.audioBuffers.get(clipId);
    this.init();
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(clipId, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn(`[AudioEngine] Failed to decode clip ${clipId}:`, err);
      return null;
    }
  }

  removeBuffer(clipId) {
    this.audioBuffers.delete(clipId);
  }

  /* ─── Impulse Response & Curve Generation ─── */

  _generateImpulseResponse(type) {
    const cfg = {
      room:    { duration: 0.8,  decay: 3.0 },
      plate:   { duration: 1.5,  decay: 2.5 },
      hall:    { duration: 3.0,  decay: 2.0 },
      valhalla:{ duration: 5.0,  decay: 1.5 },
    };
    const { duration, decay } = cfg[type] || cfg.room;
    const length = Math.floor(this.ctx.sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  _makeSaturationCurve(drive) {
    const k = drive * 2;
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  _makeLinearCurve() {
    const curve = new Float32Array(44100);
    for (let i = 0; i < 44100; i++) curve[i] = (i * 2) / 44100 - 1;
    return curve;
  }

  /* ─── Track Effect Chains ─── */

  ensureTrackChain(trackId) {
    if (this.trackChains.has(trackId)) return this.trackChains.get(trackId);
    this.init();

    const c = {};

    // Input gain (clips connect here)
    c.input = this.ctx.createGain();

    // 3-band EQ
    c.eqLow = this.ctx.createBiquadFilter();
    c.eqLow.type = 'lowshelf';   c.eqLow.frequency.value = 200;  c.eqLow.gain.value = 0;
    c.eqMid = this.ctx.createBiquadFilter();
    c.eqMid.type = 'peaking';    c.eqMid.frequency.value = 1000; c.eqMid.Q.value = 1; c.eqMid.gain.value = 0;
    c.eqHigh = this.ctx.createBiquadFilter();
    c.eqHigh.type = 'highshelf';  c.eqHigh.frequency.value = 4000; c.eqHigh.gain.value = 0;

    // De-Esser (high-shelf reduction)
    c.deEsser = this.ctx.createBiquadFilter();
    c.deEsser.type = 'highshelf'; c.deEsser.frequency.value = 5000; c.deEsser.gain.value = 0;

    // Compressor
    c.compressor = this.ctx.createDynamicsCompressor();
    c.compressor.threshold.value = 0;
    c.compressor.knee.value = 10;
    c.compressor.ratio.value = 1;
    c.compressor.attack.value = 0.003;
    c.compressor.release.value = 0.25;

    // Saturation
    c.saturation = this.ctx.createWaveShaper();
    c.saturation.oversample = '2x';
    c.saturation.curve = this._makeLinearCurve();

    // Dry path gain
    c.dryGain = this.ctx.createGain();
    c.dryGain.gain.value = 1;

    // Reverb send (parallel)
    c.reverbSend = this.ctx.createGain();
    c.reverbSend.gain.value = 0;
    c.convolver = this.ctx.createConvolver();
    c.convolver.buffer = this._generateImpulseResponse('room');
    c.reverbWet = this.ctx.createGain();
    c.reverbWet.gain.value = 0;
    c._lastReverbType = 'room';

    // Delay send (parallel)
    c.delaySend = this.ctx.createGain();
    c.delaySend.gain.value = 0;
    c.delay = this.ctx.createDelay(2.0);
    c.delay.delayTime.value = 0.25;
    c.delayFeedback = this.ctx.createGain();
    c.delayFeedback.gain.value = 0.35;
    c.delayWet = this.ctx.createGain();
    c.delayWet.gain.value = 0;

    // Track output
    c.trackGain = this.ctx.createGain();
    c.trackGain.gain.value = 1;

    // Pan
    if (this.ctx.createStereoPanner) {
      c.pan = this.ctx.createStereoPanner();
      c.pan.pan.value = 0;
    }

    /* ─ Wiring ─ */
    // Input → EQ → De-Esser → Compressor → Saturation
    c.input.connect(c.eqLow);
    c.eqLow.connect(c.eqMid);
    c.eqMid.connect(c.eqHigh);
    c.eqHigh.connect(c.deEsser);
    c.deEsser.connect(c.compressor);
    c.compressor.connect(c.saturation);

    // Saturation → Dry path
    c.saturation.connect(c.dryGain);
    c.dryGain.connect(c.trackGain);

    // Saturation → Reverb send (parallel)
    c.saturation.connect(c.reverbSend);
    c.reverbSend.connect(c.convolver);
    c.convolver.connect(c.reverbWet);
    c.reverbWet.connect(c.trackGain);

    // Saturation → Delay send (parallel)
    c.saturation.connect(c.delaySend);
    c.delaySend.connect(c.delay);
    c.delay.connect(c.delayFeedback);
    c.delayFeedback.connect(c.delay); // feedback loop
    c.delay.connect(c.delayWet);
    c.delayWet.connect(c.trackGain);

    // Track output → Pan → Master
    if (c.pan) {
      c.trackGain.connect(c.pan);
      c.pan.connect(this.masterGain);
    } else {
      c.trackGain.connect(this.masterGain);
    }

    this.trackChains.set(trackId, c);
    return c;
  }

  /* ─── Effect Parameter Updates (real-time, no restart) ─── */

  updateEffects(trackId, effects) {
    const c = this.trackChains.get(trackId);
    if (!c || !effects) return;

    // EQ
    if (effects.eq) {
      const on = effects.eq.enabled;
      c.eqLow.gain.value  = on ? (effects.eq.lowGain  || 0) : 0;
      c.eqMid.gain.value  = on ? (effects.eq.midGain  || 0) : 0;
      c.eqHigh.gain.value = on ? (effects.eq.highGain || 0) : 0;
      if (effects.eq.lowFreq)  c.eqLow.frequency.value  = effects.eq.lowFreq;
      if (effects.eq.midFreq)  c.eqMid.frequency.value  = effects.eq.midFreq;
      if (effects.eq.highFreq) c.eqHigh.frequency.value = effects.eq.highFreq;
    }

    // De-Esser (reduces high-frequency energy)
    if (effects.deEsser) {
      c.deEsser.gain.value = effects.deEsser.enabled
        ? -(effects.deEsser.amount / 100) * 15
        : 0;
    }

    // Compressor
    if (effects.compressor) {
      if (effects.compressor.enabled) {
        c.compressor.threshold.value = effects.compressor.threshold;
        c.compressor.ratio.value = effects.compressor.ratio;
      } else {
        c.compressor.threshold.value = 0;
        c.compressor.ratio.value = 1;
      }
    }

    // Reverb
    if (effects.reverb) {
      const mix = effects.reverb.enabled ? effects.reverb.mix / 100 : 0;
      c.reverbSend.gain.value = mix;
      c.reverbWet.gain.value  = mix;
      c.dryGain.gain.value    = 1 - mix * 0.5;
      if (effects.reverb.type && c._lastReverbType !== effects.reverb.type) {
        try {
          c.convolver.buffer = this._generateImpulseResponse(effects.reverb.type);
          c._lastReverbType = effects.reverb.type;
        } catch (_) {}
      }
    }

    // Delay
    if (effects.delay) {
      const mix = effects.delay.enabled ? effects.delay.mix / 100 : 0;
      c.delaySend.gain.value = mix;
      c.delayWet.gain.value  = mix;
      const times = { '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };
      c.delay.delayTime.value = times[effects.delay.time] || 0.25;
    }

    // Saturation
    if (effects.saturation) {
      c.saturation.curve = (effects.saturation.enabled && effects.saturation.drive > 0)
        ? this._makeSaturationCurve(effects.saturation.drive)
        : this._makeLinearCurve();
    }
  }

  /* ─── Volume / Mute / Solo ─── */

  updateTrackVolume(trackId, volume, shouldPlay) {
    const c = this.trackChains.get(trackId);
    if (!c) return;
    c.trackGain.gain.setTargetAtTime(shouldPlay ? volume : 0, this.ctx.currentTime, 0.02);
  }

  updateTrackPan(trackId, panValue) {
    const c = this.trackChains.get(trackId);
    if (c && c.pan) c.pan.pan.value = panValue;
  }

  updateClipGain(clipId, gain) {
    const entry = this.activeSources.get(clipId);
    if (entry && entry.clipGainNode) {
      entry.clipGainNode.gain.value = gain;
    }
  }

  setMasterMute(muted) {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.01);
  }

  /* ─── Playback ─── */

  startPlayback(tracks, playheadTime, clipDurations) {
    this.init();
    this.stopAllSources();

    this.isPlaying = true;
    
    // 1. Establish a single ground-truth scheduling reference time slightly in the future (50ms buffer)
    // This allows the JS loop to finish scheduling all clips before the audio actually starts playing!
    const SCHEDULE_LATENCY = 0.05; 
    const baseCtxTime = this.ctx.currentTime + SCHEDULE_LATENCY;
    
    this.playStartCtxTime = baseCtxTime;
    this.playStartPlayhead = playheadTime;

    const anySolo = tracks.some(t => t.isSoloed);

    tracks.forEach(t => {
      const chain = this.ensureTrackChain(t.id);

      // Apply mute/solo/volume
      const shouldPlay = anySolo ? t.isSoloed : !t.isMuted;
      const trackVol = t.volume !== undefined ? t.volume : 1;
      chain.trackGain.gain.value = shouldPlay ? trackVol : 0;

      // Apply effects
      if (t.effects) this.updateEffects(t.id, t.effects);

      // Apply pan
      if (t.pan !== undefined) this.updateTrackPan(t.id, t.pan);

      // Schedule each clip
      t.clips.forEach(c => {
        if (c.isMuted) return;
        const buffer = this.audioBuffers.get(c.id);
        if (!buffer) return;

        const clipGain = c.gain !== undefined ? c.gain : 1;
        const trimStart = c.trimStartSec || 0;
        const rawDur = c.trimEndSec || clipDurations[c.id] || buffer.duration;
        const clipDur = rawDur - trimStart;
        const clipStart = c.offset || 0;
        const clipEnd = clipStart + clipDur;

        if (playheadTime >= clipEnd) return; // Already past

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const clipGainNode = this.ctx.createGain();
        clipGainNode.gain.value = clipGain;
        source.connect(clipGainNode);
        clipGainNode.connect(chain.input);

        // Auto-remove when done (check to prevent old stopped sources from removing new ones during rapid seeks)
        source.onended = () => {
          const current = this.activeSources.get(c.id);
          if (current && current.source === source) {
            this.activeSources.delete(c.id);
          }
        };

        // 2. PERFECT SYNC: Calculate exact absolute time on the Context Clock this clip should start
        const absoluteScheduledTime = baseCtxTime + (clipStart - playheadTime);

        if (absoluteScheduledTime <= baseCtxTime) {
          // Clip already in progress — start immediately at the right offset (scheduled at baseCtxTime to sync with others)
          const offsetInClip = (playheadTime - clipStart) + trimStart;
          const remaining = clipEnd - playheadTime;
          source.start(baseCtxTime, offsetInClip, remaining);
        } else {
          // Clip starts in the future — schedule it precisely
          source.start(absoluteScheduledTime, trimStart, clipDur);
        }

        this.activeSources.set(c.id, { source, clipGainNode });
      });
    });
  }

  stopAllSources() {
    this.activeSources.forEach(({ source }) => {
      try { source.stop(); } catch (_) {}
    });
    this.activeSources.clear();
    this.isPlaying = false;
  }

  getCurrentTime() {
    if (!this.isPlaying || !this.ctx) return this.playStartPlayhead;
    
    // We scheduled audio with a 50ms buffer, so the visual playhead should wait for the buffer to elapse
    // before it starts moving to stay in perfect frame-accurate sync!
    const elapsed = this.ctx.currentTime - this.playStartCtxTime;
    if (elapsed < 0) return this.playStartPlayhead;
    
    return this.playStartPlayhead + elapsed;
  }
}

const engine = new AudioPlaybackEngine();
export default engine;

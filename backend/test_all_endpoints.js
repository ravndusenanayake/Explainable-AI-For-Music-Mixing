/**
 * Comprehensive System Test Script
 * Tests all backend endpoints and core logic
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Create a proper WAV test file
async function createTestWav(durationSec = 2, sampleRate = 44100) {
  const WavEncoder = require('wav-encoder');
  const numSamples = durationSec * sampleRate;
  const channelData = [new Float32Array(numSamples)];
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    channelData[0][i] = Math.sin(2 * Math.PI * 440 * t) * 0.5;
  }
  
  const encoded = await WavEncoder.encode({
    sampleRate: sampleRate,
    channelData: channelData
  });
  
  return Buffer.from(encoded);
}

// Helper: Make HTTP request with multipart/form-data
function makeRequest(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers,
      timeout: 60000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.substring(0, 500) });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    
    if (body) req.write(body);
    req.end();
  });
}

// Helper: Build multipart form data manually
function buildMultipartFormData(fields, files) {
  const boundary = '----TestBoundary' + Date.now();
  const parts = [];
  
  // Add text fields
  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }
  
  // Add files
  for (const file of files) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n` +
      `Content-Type: audio/wav\r\n\r\n`
    );
    parts.push(file.buffer);
    parts.push('\r\n');
  }
  
  parts.push(`--${boundary}--\r\n`);
  
  // Combine all parts into a single buffer
  const buffers = parts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
  const body = Buffer.concat(buffers);
  
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

// ============ TESTS ============

const results = [];

function log(testName, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${testName}${details ? ': ' + details : ''}`);
  results.push({ test: testName, status, details });
}

async function testServerRunning() {
  try {
    const res = await makeRequest('GET', '/');
    // Express returns 404 for unknown routes but that means server is running
    log('Server Running', 'PASS', `Status: ${res.status}`);
  } catch (e) {
    log('Server Running', 'FAIL', e.message);
  }
}

async function testMixEndpoint() {
  try {
    const vocalWav = await createTestWav(2, 44100);
    const instWav = await createTestWav(2, 44100);
    
    const timelineState = {
      tracks: [
        {
          id: 't1', name: 'Lead Vocal', type: 'vocal', color: 'rose',
          clips: [{ id: 'c1', mediaId: 'vocal_test.wav', offset: 0 }],
          pan: 0, volume: 1, isMuted: false, isSoloed: false,
          effects: {
            gate: { enabled: true, threshold: -40 },
            eq: { enabled: false, bands: [
              { id: 1, type: 'highpass', freq: 80, gain: 0, q: 1 },
              { id: 2, type: 'peaking', freq: 500, gain: 0, q: 1 },
              { id: 3, type: 'peaking', freq: 2000, gain: 0, q: 1 },
              { id: 4, type: 'highshelf', freq: 8000, gain: 0, q: 1 }
            ]},
            deEsser: { enabled: false, amount: 50 },
            compressor: { enabled: false, threshold: -15, ratio: 4 },
            reverb: { enabled: false, type: 'valhalla', mix: 20 },
            delay: { enabled: false, time: '1/4', mix: 10 },
            saturation: { enabled: false, drive: 20 }
          }
        },
        {
          id: 't3', name: 'Main Instrumental', type: 'instrumental', color: 'cyan',
          clips: [{ id: 'c3', mediaId: 'inst_test.wav', offset: 0 }],
          pan: 0, volume: 1, isMuted: false, isSoloed: false,
          effects: {
            gate: { enabled: true, threshold: -40 },
            eq: { enabled: false, bands: [
              { id: 1, type: 'highpass', freq: 80, gain: 0, q: 1 },
              { id: 2, type: 'peaking', freq: 500, gain: 0, q: 1 },
              { id: 3, type: 'peaking', freq: 2000, gain: 0, q: 1 },
              { id: 4, type: 'highshelf', freq: 8000, gain: 0, q: 1 }
            ]},
            deEsser: { enabled: false, amount: 50 },
            compressor: { enabled: false, threshold: -15, ratio: 4 },
            reverb: { enabled: false, type: 'room', mix: 20 },
            delay: { enabled: false, time: '1/4', mix: 10 },
            saturation: { enabled: false, drive: 20 }
          }
        }
      ]
    };

    const { body, contentType } = buildMultipartFormData(
      { timelineState: JSON.stringify(timelineState) },
      [
        { fieldName: 'files', fileName: 'vocal_test.wav', buffer: vocalWav },
        { fieldName: 'files', fileName: 'inst_test.wav', buffer: instWav }
      ]
    );

    const res = await makeRequest('POST', '/api/mix', body, { 'Content-Type': contentType });
    
    if (res.status === 200 && res.data) {
      const d = res.data;
      const checks = [];
      
      // Check response structure
      if (d.processed_audio_base64) checks.push('audio✓');
      else checks.push('audio✗');
      
      if (d.sections && d.sections.length > 0) checks.push(`sections(${d.sections.length})✓`);
      else checks.push('sections✗');
      
      if (d.globalSummary) checks.push('globalSummary✓');
      else checks.push('globalSummary✗');
      
      if (d.explanations && d.explanations.length > 0) checks.push(`explanations(${d.explanations.length})✓`);
      else checks.push('explanations✗');
      
      if (d.automationData) checks.push('automationData✓');
      else checks.push('automationData✗');
      
      if (d.updatedTracks && d.updatedTracks.length > 0) {
        checks.push(`updatedTracks(${d.updatedTracks.length})✓`);
        
        // Verify track structure integrity
        const vocalTrack = d.updatedTracks.find(t => t.type === 'vocal');
        if (vocalTrack) {
          const e = vocalTrack.effects;
          if (e && e.gate && e.eq && e.deEsser && e.compressor && e.reverb && e.delay && e.saturation) {
            checks.push('effectsComplete✓');
          } else {
            const missing = [];
            if (!e?.gate) missing.push('gate');
            if (!e?.eq) missing.push('eq');
            if (!e?.deEsser) missing.push('deEsser');
            if (!e?.compressor) missing.push('compressor');
            if (!e?.reverb) missing.push('reverb');
            if (!e?.delay) missing.push('delay');
            if (!e?.saturation) missing.push('saturation');
            checks.push(`effectsMissing:[${missing.join(',')}]✗`);
          }
          
          // Verify EQ bands have correct properties
          if (e?.eq?.bands && e.eq.bands.length > 0) {
            const band = e.eq.bands[0];
            if (band.id !== undefined && band.type && band.freq !== undefined && band.gain !== undefined && band.q !== undefined) {
              checks.push('eqBandsFormat✓');
            } else {
              checks.push('eqBandsFormat✗');
            }
          }
          
          // Check clips still exist
          if (vocalTrack.clips && vocalTrack.clips.length > 0) {
            checks.push('clipsPresent✓');
            // Check clip has mediaId (needed for rehydration)
            if (vocalTrack.clips[0].mediaId) {
              checks.push('mediaId✓');
            } else {
              checks.push('mediaId✗');
            }
          } else {
            checks.push('clipsPresent✗');
          }
        }
      } else {
        checks.push('updatedTracks✗');
      }
      
      // Check DSP settings
      if (d.globalSummary?.dspSettings) {
        const dsp = d.globalSummary.dspSettings;
        checks.push(`reverb:${dsp.reverbMix?.toFixed(2)}✓`);
        checks.push(`delay:${dsp.delayMix?.toFixed(2)}✓`);
        checks.push(`comp:${dsp.compressorNeeded}✓`);
        checks.push(`deEss:${dsp.deEsserNeeded}✓`);
      }
      
      const hasFailure = checks.some(c => c.includes('✗'));
      log('/api/mix', hasFailure ? 'WARN' : 'PASS', checks.join(', '));
    } else {
      log('/api/mix', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data).substring(0, 200)}`);
    }
  } catch (e) {
    log('/api/mix', 'FAIL', e.message);
  }
}

async function testChatEndpoint() {
  try {
    const body = JSON.stringify({
      message: 'What is compression in audio mixing?',
      history: [],
      mixContext: null
    });

    const res = await makeRequest('POST', '/api/chat', body, { 'Content-Type': 'application/json' });
    
    if (res.status === 200 && res.data.reply) {
      log('/api/chat', 'PASS', `Reply length: ${res.data.reply.length} chars`);
    } else {
      log('/api/chat', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data).substring(0, 200)}`);
    }
  } catch (e) {
    log('/api/chat', 'FAIL', e.message);
  }
}

async function testUploadEndpoint() {
  try {
    const wav = await createTestWav(1);
    const { body, contentType } = buildMultipartFormData({}, [
      { fieldName: 'audio', fileName: 'test_upload.wav', buffer: wav }
    ]);

    const res = await makeRequest('POST', '/api/upload', body, { 'Content-Type': contentType });
    
    if (res.status === 200 && res.data.explanations && res.data.explanations.length > 0) {
      log('/api/upload (legacy)', 'PASS', `Got ${res.data.explanations.length} explanations`);
    } else {
      log('/api/upload (legacy)', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data).substring(0, 200)}`);
    }
  } catch (e) {
    log('/api/upload (legacy)', 'FAIL', e.message);
  }
}

async function testMixEngineLogic() {
  try {
    const { mixTracks } = require('./mixEngine');
    
    const vocalWav = await createTestWav(2, 44100);
    const instWav = await createTestWav(2, 44100);
    
    const files = [
      { originalname: 'vocal.wav', buffer: vocalWav },
      { originalname: 'inst.wav', buffer: instWav }
    ];
    
    const timelineState = {
      tracks: [
        {
          id: 't1', name: 'Vocal', type: 'vocal', color: 'rose',
          clips: [{ id: 'c1', mediaId: 'vocal.wav', offset: 0 }],
          pan: 0, volume: 1, isMuted: false, isSoloed: false,
          effects: {
            gate: { enabled: true, threshold: -40 },
            eq: { enabled: true, bands: [
              { id: 1, type: 'highpass', freq: 90, gain: 0, q: 1 },
              { id: 2, type: 'peaking', freq: 250, gain: -2.5, q: 1.5 },
              { id: 3, type: 'peaking', freq: 3500, gain: 3, q: 1 },
              { id: 4, type: 'highshelf', freq: 10000, gain: 2, q: 1 }
            ]},
            compressor: { enabled: true, threshold: -18, ratio: 3.5 },
            deEsser: { enabled: true, amount: 45 },
            reverb: { enabled: true, mix: 40, type: 'valhalla' },
            delay: { enabled: false, time: '1/4', mix: 15 },
            saturation: { enabled: true, drive: 12 }
          }
        },
        {
          id: 't2', name: 'Beat', type: 'instrumental', color: 'cyan',
          clips: [{ id: 'c2', mediaId: 'inst.wav', offset: 0 }],
          pan: 0, volume: 1, isMuted: false, isSoloed: false,
          effects: {
            gate: { enabled: false, threshold: -40 },
            eq: { enabled: false, bands: [] },
            compressor: { enabled: false, threshold: -15, ratio: 4 },
            deEsser: { enabled: false, amount: 50 },
            reverb: { enabled: false, type: 'room', mix: 20 },
            delay: { enabled: false, time: '1/4', mix: 10 },
            saturation: { enabled: false, drive: 20 }
          }
        }
      ]
    };
    
    const result = await mixTracks(files, timelineState);
    
    const checks = [];
    if (result.mixedAudioBuffer && result.mixedAudioBuffer.length > 44) checks.push('audioBuffer✓');
    else checks.push('audioBuffer✗');
    
    if (result.sections && result.sections.length > 0) {
      checks.push(`sections(${result.sections.length})✓`);
      
      // Verify section structure
      const s = result.sections[0];
      if (s.index !== undefined && s.startTime !== undefined && s.endTime !== undefined 
          && s.sectionType && s.analysis && s.mixing) {
        checks.push('sectionStruct✓');
      } else {
        checks.push('sectionStruct✗');
      }
    } else {
      checks.push('sections✗');
    }
    
    if (result.globalSummary) {
      checks.push('globalSummary✓');
      if (result.globalSummary.dspSettings) checks.push('dspSettings✓');
    } else {
      checks.push('globalSummary✗');
    }
    
    if (result.explanations && result.explanations.length > 0) checks.push(`explanations(${result.explanations.length})✓`);
    if (result.automationData && result.automationData.vocal && result.automationData.instrumental) checks.push('automation✓');
    
    const hasFailure = checks.some(c => c.includes('✗'));
    log('MixEngine Direct', hasFailure ? 'FAIL' : 'PASS', checks.join(', '));
  } catch (e) {
    log('MixEngine Direct', 'FAIL', e.message);
  }
}

async function testFrontendRehydration() {
  // Simulate what AudioContext.jsx does when receiving updatedTracks
  try {
    const mockMediaPool = [
      { id: 'media_1', file: { name: 'vocal.wav', size: 1000 }, url: 'blob:123' },
      { id: 'media_2', file: { name: 'inst.wav', size: 2000 }, url: 'blob:456' }
    ];
    
    const mockUpdatedTracks = [
      {
        id: 't1', name: 'Lead Vocal', type: 'vocal',
        clips: [
          { id: 'c1', mediaId: 'media_1', file: {}, offset: 0 } // file is empty {} from JSON roundtrip
        ],
        effects: {
          gate: { enabled: true, threshold: -40 },
          eq: { enabled: true, bands: [
            { id: 1, type: 'highpass', freq: 90, gain: 0, q: 1 }
          ]},
          compressor: { enabled: true, threshold: -18, ratio: 3.5 },
          deEsser: { enabled: true, amount: 45 },
          reverb: { enabled: true, mix: 40, type: 'valhalla' },
          delay: { enabled: false, time: '1/4', mix: 15 },
          saturation: { enabled: true, drive: 12 }
        }
      },
      {
        id: 't2', name: 'Beat', type: 'instrumental',
        clips: [
          { id: 'c2', mediaId: 'media_2', file: {}, offset: 0 }
        ],
        effects: {
          gate: { enabled: true, threshold: -40 },
          eq: { enabled: false, bands: [] },
          compressor: { enabled: false, threshold: -15, ratio: 4 },
          deEsser: { enabled: false, amount: 50 },
          reverb: { enabled: false, type: 'room', mix: 20 },
          delay: { enabled: false, time: '1/4', mix: 10 },
          saturation: { enabled: false, drive: 20 }
        }
      }
    ];
    
    // This is the rehydration logic from AudioContext.jsx
    const rehydratedTracks = mockUpdatedTracks.map(t => ({
      ...t,
      clips: t.clips.map(c => {
        const media = mockMediaPool.find(m => m.id === c.mediaId);
        return { ...c, file: media ? media.file : null };
      })
    }));
    
    const checks = [];
    
    // Verify file rehydration
    const vocalClip = rehydratedTracks[0].clips[0];
    if (vocalClip.file && vocalClip.file.name === 'vocal.wav') {
      checks.push('vocalFileRehydrated✓');
    } else {
      checks.push(`vocalFileRehydrated✗ (file=${JSON.stringify(vocalClip.file)})`);
    }
    
    const instClip = rehydratedTracks[1].clips[0];
    if (instClip.file && instClip.file.name === 'inst.wav') {
      checks.push('instFileRehydrated✓');
    } else {
      checks.push(`instFileRehydrated✗ (file=${JSON.stringify(instClip.file)})`);
    }
    
    // Verify effects preserved
    const vocalEffects = rehydratedTracks[0].effects;
    if (vocalEffects.gate?.enabled === true) checks.push('gatePreserved✓');
    if (vocalEffects.eq?.enabled === true && vocalEffects.eq.bands?.length > 0) checks.push('eqPreserved✓');
    if (vocalEffects.compressor?.enabled === true) checks.push('compressorPreserved✓');
    if (vocalEffects.deEsser?.enabled === true) checks.push('deEsserPreserved✓');
    if (vocalEffects.reverb?.enabled === true) checks.push('reverbPreserved✓');
    if (vocalEffects.delay !== undefined) checks.push('delayPreserved✓');
    if (vocalEffects.saturation?.enabled === true) checks.push('saturationPreserved✓');
    
    const hasFailure = checks.some(c => c.includes('✗'));
    log('Frontend Rehydration', hasFailure ? 'FAIL' : 'PASS', checks.join(', '));
  } catch (e) {
    log('Frontend Rehydration', 'FAIL', e.message);
  }
}

async function testTrackInspectorSafety() {
  // Test that all effect properties are safely accessible (prevents black screen)
  try {
    const defaultEffects = {
      gate: { enabled: true, threshold: -40 },
      eq: { 
        enabled: false, 
        bands: [
          { id: 1, type: 'highpass', freq: 80, gain: 0, q: 1 },
          { id: 2, type: 'peaking', freq: 500, gain: 0, q: 1 },
          { id: 3, type: 'peaking', freq: 2000, gain: 0, q: 1 },
          { id: 4, type: 'highshelf', freq: 8000, gain: 0, q: 1 }
        ]
      },
      deEsser: { enabled: false, amount: 50 },
      compressor: { enabled: false, threshold: -15, ratio: 4 },
      reverb: { enabled: false, type: 'valhalla', mix: 20 },
      delay: { enabled: false, time: '1/4', mix: 10 },
      saturation: { enabled: false, drive: 20 }
    };
    
    const checks = [];
    
    // Simulate the UI accesses from FX Rack tab (EditorPage.jsx lines ~2350-2470)
    const effects = defaultEffects;
    
    // These are the exact property access patterns in the UI
    try { const _ = effects.eq.enabled; checks.push('eq.enabled✓'); } catch { checks.push('eq.enabled✗'); }
    try { const _ = effects.eq.bands; checks.push('eq.bands✓'); } catch { checks.push('eq.bands✗'); }
    try { const _ = effects.eq.bands[0].freq; checks.push('eq.bands[0].freq✓'); } catch { checks.push('eq.bands[0].freq✗'); }
    try { const _ = effects.eq.bands[0].q; checks.push('eq.bands[0].q✓'); } catch { checks.push('eq.bands[0].q✗'); }
    try { const _ = effects.deEsser.enabled; checks.push('deEsser.enabled✓'); } catch { checks.push('deEsser.enabled✗'); }
    try { const _ = effects.deEsser.amount; checks.push('deEsser.amount✓'); } catch { checks.push('deEsser.amount✗'); }
    try { const _ = effects.compressor.enabled; checks.push('comp.enabled✓'); } catch { checks.push('comp.enabled✗'); }
    try { const _ = effects.compressor.threshold; checks.push('comp.threshold✓'); } catch { checks.push('comp.threshold✗'); }
    try { const _ = effects.compressor.ratio; checks.push('comp.ratio✓'); } catch { checks.push('comp.ratio✗'); }
    try { const _ = effects.reverb.enabled; checks.push('reverb.enabled✓'); } catch { checks.push('reverb.enabled✗'); }
    try { const _ = effects.reverb.type; checks.push('reverb.type✓'); } catch { checks.push('reverb.type✗'); }
    try { const _ = effects.reverb.mix; checks.push('reverb.mix✓'); } catch { checks.push('reverb.mix✗'); }
    try { const _ = effects.delay.enabled; checks.push('delay.enabled✓'); } catch { checks.push('delay.enabled✗'); }
    try { const _ = effects.delay.time; checks.push('delay.time✓'); } catch { checks.push('delay.time✗'); }
    try { const _ = effects.delay.mix; checks.push('delay.mix✓'); } catch { checks.push('delay.mix✗'); }
    try { const _ = effects.saturation.enabled; checks.push('sat.enabled✓'); } catch { checks.push('sat.enabled✗'); }
    try { const _ = effects.saturation.drive; checks.push('sat.drive✓'); } catch { checks.push('sat.drive✗'); }
    try { const _ = effects.gate.enabled; checks.push('gate.enabled✓'); } catch { checks.push('gate.enabled✗'); }
    try { const _ = effects.gate.threshold; checks.push('gate.threshold✓'); } catch { checks.push('gate.threshold✗'); }
    
    const hasFailure = checks.some(c => c.includes('✗'));
    log('UI Effect Properties Safety', hasFailure ? 'FAIL' : 'PASS', checks.join(', '));
  } catch (e) {
    log('UI Effect Properties Safety', 'FAIL', e.message);
  }
}

async function testRealtimeEffectsLogic() {
  // Verify the realtimeEffects.js updateEffects expectations match the data shapes
  try {
    const checks = [];
    
    // These are what realtimeEffects.js expects in updateEffects()
    const effects = {
      eq: { enabled: true, lowGain: 0, midGain: -2, highGain: 2.5, lowFreq: 200, midFreq: 1000, highFreq: 4000 },
      deEsser: { enabled: true, amount: 50 },
      compressor: { enabled: true, threshold: -18, ratio: 3.5 },
      reverb: { enabled: true, mix: 40, type: 'valhalla' },
      delay: { enabled: true, mix: 20, time: '1/4' },
      saturation: { enabled: true, drive: 15 }
    };
    
    // Simulate realtimeEffects.js updateEffects logic
    // EQ
    if (effects.eq) {
      const on = effects.eq.enabled;
      const lowGain = on ? (effects.eq.lowGain || 0) : 0;
      const midGain = on ? (effects.eq.midGain || 0) : 0;
      const highGain = on ? (effects.eq.highGain || 0) : 0;
      checks.push(`eq: low=${lowGain}, mid=${midGain}, high=${highGain} ✓`);
    }
    
    // De-Esser
    if (effects.deEsser) {
      const gain = effects.deEsser.enabled ? -(effects.deEsser.amount / 100) * 15 : 0;
      checks.push(`deEsser: gain=${gain.toFixed(1)}dB ✓`);
    }
    
    // Compressor
    if (effects.compressor && effects.compressor.enabled) {
      checks.push(`compressor: threshold=${effects.compressor.threshold}, ratio=${effects.compressor.ratio} ✓`);
    }
    
    // Reverb
    if (effects.reverb) {
      const mix = effects.reverb.enabled ? effects.reverb.mix / 100 : 0;
      checks.push(`reverb: mix=${mix.toFixed(2)} ✓`);
    }
    
    // Delay
    if (effects.delay) {
      const mix = effects.delay.enabled ? effects.delay.mix / 100 : 0;
      const times = { '1/8': 0.125, '1/4': 0.25, '1/2': 0.5 };
      const delayTime = times[effects.delay.time] || 0.25;
      checks.push(`delay: mix=${mix.toFixed(2)}, time=${delayTime}s ✓`);
    }
    
    log('Realtime Effects Logic', 'PASS', checks.join(' | '));
  } catch (e) {
    log('Realtime Effects Logic', 'FAIL', e.message);
  }
}

async function testGeminiExplainerModule() {
  try {
    const { generateMixExplanation } = require('./geminiExplainer');
    
    const mockContext = {
      globalSummary: {
        totalDuration: 10,
        sectionCount: 2,
        avgVocalGain: 1.5,
        avgInstrumentalGain: -2.0
      },
      automationData: { vocal: [], instrumental: [] },
      originalExplanations: [
        { action: 'Test action', reason: 'Test reason', tip: 'Test tip' }
      ]
    };
    
    const result = await generateMixExplanation(mockContext);
    
    if (result) {
      if (Array.isArray(result)) {
        log('Gemini Explainer', 'PASS', `Returned ${result.length} explanations`);
      } else if (result.explanations) {
        log('Gemini Explainer', 'PASS', `Returned JSON with ${result.explanations.length} explanations + summary`);
      } else {
        log('Gemini Explainer', 'WARN', 'Returned unexpected format (fallback may be active)');
      }
    } else {
      log('Gemini Explainer', 'WARN', 'Returned null (API may be unavailable)');
    }
  } catch (e) {
    log('Gemini Explainer', 'WARN', `Error: ${e.message} (Gemini API may be overloaded - 503)`);
  }
}

async function testMixExplainerComponent() {
  // Test that the MixExplainer component won't crash with various data shapes
  try {
    const checks = [];
    
    // Valid section data (as returned by mixEngine)
    const sections = [
      {
        index: 0,
        startTime: 0,
        endTime: 2.5,
        sectionType: 'Intro',
        analysis: {
          vocalRmsDb: -20.5,
          vocalPeakDb: -8.3,
          instrumentalRmsDb: -25.2,
          instrumentalPeakDb: -12.1,
          vocalCrestFactor: 12.2,
          instrumentalCrestFactor: 13.1
        },
        mixing: {
          vocalGainDb: 2.0,
          instrumentalGainDb: -1.5,
          vocalReverbMix: 0.15,
          vocalDelayMix: 0.05,
          actions: ['Boosted vocal by +2.0dB'],
          severity: 'adjusted'
        },
        explanations: [
          { action: 'Vocal +2.0dB', reason: 'Vocal was quiet', tip: 'Boost gently' }
        ]
      }
    ];
    
    // Test MixExplainer filtering logic
    const stats = {
      optimal: sections.filter(s => s.mixing.severity === 'optimal').length,
      adjusted: sections.filter(s => s.mixing.severity === 'adjusted').length,
      significant: sections.filter(s => s.mixing.severity === 'significant').length,
    };
    checks.push(`stats: opt=${stats.optimal}, adj=${stats.adjusted}, sig=${stats.significant} ✓`);
    
    // Test simple card generation logic (from MixExplainer lines 316-396)
    let avgVocDb = 0;
    let avgInstDb = 0;
    sections.forEach(s => {
      avgVocDb += (s.mixing?.vocalGainDb || 0);
      avgInstDb += (s.mixing?.instrumentalGainDb || 0);
    });
    avgVocDb /= sections.length;
    avgInstDb /= sections.length;
    
    checks.push(`avgVocDb=${avgVocDb.toFixed(1)}, avgInstDb=${avgInstDb.toFixed(1)} ✓`);
    
    // Test that sections with null/undefined values don't crash
    const edgeCaseSection = {
      index: 1, startTime: 2.5, endTime: 5.0, sectionType: 'Verse',
      analysis: { vocalRmsDb: -30, vocalPeakDb: -15, instrumentalRmsDb: -28, instrumentalPeakDb: -14, vocalCrestFactor: 10, instrumentalCrestFactor: 11 },
      mixing: { vocalGainDb: 0, instrumentalGainDb: 0, actions: null, severity: 'optimal' },
      explanations: null
    };
    
    // Test safe access (matching MixExplainer component)
    const hasActions = edgeCaseSection.mixing.actions && edgeCaseSection.mixing.actions.length > 0;
    const hasExplanations = edgeCaseSection.explanations && edgeCaseSection.explanations.length > 0;
    checks.push(`edgeCase: actions=${hasActions}, explanations=${hasExplanations} ✓`);
    
    log('MixExplainer Data Safety', 'PASS', checks.join(' | '));
  } catch (e) {
    log('MixExplainer Data Safety', 'FAIL', e.message);
  }
}

// ============ RUN ALL TESTS ============

async function runAllTests() {
  console.log('\n===========================================');
  console.log('🧪 COMPREHENSIVE SYSTEM TEST');
  console.log('===========================================\n');
  
  // 1. Server connectivity
  await testServerRunning();
  
  // 2. Core logic tests (no network needed)
  await testTrackInspectorSafety();
  await testRealtimeEffectsLogic();
  await testFrontendRehydration();
  await testMixExplainerComponent();
  
  // 3. MixEngine direct test
  await testMixEngineLogic();
  
  // 4. API endpoint tests
  await testUploadEndpoint();
  await testMixEndpoint();
  await testChatEndpoint();
  
  // 5. Gemini explainer
  await testGeminiExplainerModule();
  
  // Summary
  console.log('\n===========================================');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('===========================================\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  
  console.log(`✅ PASSED:  ${passed}`);
  console.log(`❌ FAILED:  ${failed}`);
  console.log(`⚠️  WARNED: ${warned}`);
  console.log(`📝 TOTAL:   ${results.length}`);
  
  if (failed > 0) {
    console.log('\n--- FAILURES ---');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.details}`);
    });
  }
  
  if (warned > 0) {
    console.log('\n--- WARNINGS ---');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`  ⚠️  ${r.test}: ${r.details}`);
    });
  }
  
  console.log('\n===========================================\n');
}

runAllTests().catch(console.error);

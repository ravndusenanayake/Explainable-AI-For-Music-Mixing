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

let timelineState = {
    tracks: [
        { id: 't1', name: 'Lead Vocal', type: 'vocal', color: 'rose', clips: [], effects: JSON.parse(JSON.stringify(defaultEffects)) },
    ],
};

const result = {
    globalSummary: {
        dspSettings: {
            reverbMix: 0.12,
            delayMix: 0.05,
            compressorNeeded: true,
            deEsserNeeded: true
        }
    }
};

// 1. First block in server.js
timelineState.tracks = timelineState.tracks.map(t => {
    if (t.type === 'vocal' || (t.name && t.name.toLowerCase().includes('vocal'))) {
        if (!t.effects || (!t.effects.reverb?.enabled && !t.effects.eq?.enabled)) {
            t.effects = {
                ...t.effects,
                eq: { 
                    enabled: true, 
                    lowGain: 0,
                    midGain: -2,
                    highGain: 2.5,
                    bands: [
                        { id: 1, type: 'highpass', freq: 90, q: 1, gain: 0 },
                        { id: 2, type: 'peaking', freq: 250, q: 1.5, gain: -2.5 }, 
                        { id: 3, type: 'peaking', freq: 3500, q: 1, gain: 3.0 },  
                        { id: 4, type: 'highshelf', freq: 10000, q: 1, gain: 2.0 } 
                    ] 
                },
                compressor: { enabled: true, threshold: -18, ratio: 3.5 },
                deEsser: { enabled: true, amount: 45 },
                reverb: { enabled: true, mix: 40, type: 'valhalla' },
                delay: { enabled: false, time: '1/4', mix: 15 },
                saturation: { enabled: true, drive: 12 }
            };
        }
    }
    return t;
});

// 2. Second block in server.js
if (result.globalSummary && result.globalSummary.dspSettings) {
    timelineState.tracks = timelineState.tracks.map(t => {
        if (t.type === 'vocal' || (t.name && t.name.toLowerCase().includes('vocal'))) {
            if (t.effects && t.effects.reverb && t.effects.delay) {
                if (result.globalSummary.dspSettings.reverbMix > 0) {
                    t.effects.reverb.enabled = true;
                    t.effects.reverb.mix = Math.round(result.globalSummary.dspSettings.reverbMix * 100);
                } else {
                    t.effects.reverb.enabled = false;
                }

                if (result.globalSummary.dspSettings.delayMix > 0) {
                    t.effects.delay.enabled = true;
                    t.effects.delay.mix = Math.round(result.globalSummary.dspSettings.delayMix * 100);
                } else {
                    t.effects.delay.enabled = false;
                }

                if (result.globalSummary.dspSettings.compressorNeeded) {
                    if (t.effects.compressor) t.effects.compressor.enabled = true;
                } else {
                    if (t.effects.compressor) t.effects.compressor.enabled = false;
                }

                if (result.globalSummary.dspSettings.deEsserNeeded) {
                    if (t.effects.deEsser) t.effects.deEsser.enabled = true;
                } else {
                    if (t.effects.deEsser) t.effects.deEsser.enabled = false;
                }
            }
        }
        return t;
    });
}

console.log(JSON.stringify(timelineState.tracks[0].effects, null, 2));

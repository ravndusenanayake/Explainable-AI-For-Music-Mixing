// Utility to handle real-time Web Audio API effects for the microphone

let audioContext = null;
let mediaStreamSource = null;
let currentNodes = [];

// Initialize Audio Context
const initAudioContext = () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
};

// Create a distortion curve for the 'Rock' style
function makeDistortionCurve(amount = 50) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        let x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// Clear existing effect nodes
const clearNodes = () => {
    currentNodes.forEach(node => node.disconnect());
    currentNodes = [];
};

// Setup different effect chains
const applyEffect = (style) => {
    const ctx = initAudioContext();
    clearNodes();
    
    if (!mediaStreamSource) return;
    
    mediaStreamSource.disconnect(); // disconnect from previous destination

    let lastNode = mediaStreamSource;

    if (style === 'rock') {
        // Distortion
        const waveShaper = ctx.createWaveShaper();
        waveShaper.curve = makeDistortionCurve(200);
        waveShaper.oversample = '4x';
        
        // EQ
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.5; // Compensate for distortion volume
        
        lastNode.connect(waveShaper);
        waveShaper.connect(filter);
        filter.connect(gainNode);
        lastNode = gainNode;
        
        currentNodes.push(waveShaper, filter, gainNode);

    } else if (style === 'telephone') {
        // Telephone Effect (Bandpass + slight distortion)
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 2000;

        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 500;

        lastNode.connect(lowpass);
        lowpass.connect(highpass);
        lastNode = highpass;

        currentNodes.push(lowpass, highpass);
        
    } else if (style === 'robot') {
        // Simple Ring Modulator (Robot effect)
        const oscillator = ctx.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 50;

        const gainNode = ctx.createGain();
        lastNode.connect(gainNode);
        
        // Connect oscillator to gainNode's gain parameter for modulation
        oscillator.connect(gainNode.gain);
        oscillator.start();

        lastNode = gainNode;
        currentNodes.push(oscillator, gainNode);
    } 
    
    // Normal style (or the end of the chain) connects to destination
    lastNode.connect(ctx.destination);
};

export const startMic = async (style = 'normal') => {
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false
            } 
        });
        mediaStreamSource = ctx.createMediaStreamSource(stream);
        applyEffect(style);
        return true;
    } catch (err) {
        console.error('Error accessing microphone:', err);
        return false;
    }
};

export const stopMic = () => {
    if (mediaStreamSource) {
        mediaStreamSource.mediaStream.getTracks().forEach(track => track.stop());
        mediaStreamSource.disconnect();
        mediaStreamSource = null;
    }
    clearNodes();
};

export const changeStyle = (style) => {
    if (mediaStreamSource) {
        applyEffect(style);
    }
};

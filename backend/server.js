const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { mixTracks } = require('./mixEngine');
const { analyzePitch, correctPitch, correctTiming } = require('./pitchEngine');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer setup - using memory storage for seamless processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
});

// Helper function to handle async route errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================================
// NEW: Advanced DAW Mix Endpoint
// ============================================================
app.post('/api/mix', upload.array('files'), asyncHandler(async (req, res) => {
    console.log('\n--- New DAW Mix Request ---');
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
    }

    if (!req.body.timelineState) {
        return res.status(400).json({ error: 'No timelineState provided.' });
    }

    let timelineState;
    try {
        timelineState = JSON.parse(req.body.timelineState);
    } catch (e) {
        return res.status(400).json({ error: 'Invalid timelineState JSON.' });
    }

    console.log(`[Node] Received ${req.files.length} files. Timeline has ${timelineState.tracks.length} tracks.`);
    console.log('[Node] Starting advanced mix engine...');

    const startTime = Date.now();
    
    // Run the advanced mixing engine
    // We pass the array of Multer files, and the parsed JSON state
    const result = await mixTracks(req.files, timelineState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Node] Mix complete in ${elapsed}s`);

    // Convert mixed audio to base64 for transport
    const mixedBase64 = `data:audio/wav;base64,${result.mixedAudioBuffer.toString('base64')}`;

    return res.status(200).json({
      processed_audio_base64: mixedBase64,
      sections: result.sections,
      globalSummary: result.globalSummary,
      explanations: result.explanations,
      automationData: result.automationData
    });
}));

// ============================================================
// NEW: Voice Conversion Endpoint
// ============================================================
const { convertVoiceStyle } = require('./voiceEngine');

app.post('/api/convert-voice', upload.single('file'), asyncHandler(async (req, res) => {
    console.log('\n--- New Voice Conversion Request ---');
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const style = req.body.style || 'normal';
    console.log(`[Node] Converting ${req.file.originalname} to ${style} style.`);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const inputPath = path.join(tempDir, `temp_convert_in_${Date.now()}.wav`);
    fs.writeFileSync(inputPath, req.file.buffer);

    try {
        const outputPath = await convertVoiceStyle(inputPath, style);
        
        // Read the converted file back to buffer
        const convertedBuffer = fs.readFileSync(outputPath);
        const convertedBase64 = `data:audio/wav;base64,${convertedBuffer.toString('base64')}`;

        // Cleanup
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        return res.status(200).json({ processed_audio_base64: convertedBase64 });
    } catch (err) {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return res.status(500).json({ error: 'Failed to convert voice.' });
    }
}));

// ============================================================
// NEW: 1-Click Auto Mix Endpoint
// ============================================================
app.post('/api/automix', upload.array('files'), asyncHandler(async (req, res) => {
    console.log('\n--- New 1-Click Auto Mix Request ---');
    
    if (!req.files || req.files.length < 2) {
        return res.status(400).json({ error: 'Please upload both a vocal and instrumental track.' });
    }

    let vocalFile = req.files.find(f => f.originalname.toLowerCase().includes('vocal') || f.originalname.toLowerCase().includes('voc'));
    let instFile = req.files.find(f => f.originalname.toLowerCase().includes('inst') || f.originalname.toLowerCase().includes('beat') || f.originalname.toLowerCase().includes('karaoke')) || req.files.find(f => f !== vocalFile);
    
    // If we couldn't match by name, just assume the order from frontend (Vocal first, Inst second)
    if (!vocalFile || !instFile) {
        vocalFile = req.files[0];
        instFile = req.files[1];
    }

    console.log(`[AutoMix] Vocal: ${vocalFile.originalname}, Instrumental: ${instFile.originalname}`);

    // We need to write them to disk temporarily for the python script
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const vocalPath = path.join(tempDir, 'temp_vocal.wav');
    const instPath = path.join(tempDir, 'temp_inst.wav');
    
    fs.writeFileSync(vocalPath, vocalFile.buffer);
    fs.writeFileSync(instPath, instFile.buffer);

    console.log('[AutoMix] Running Auto-Alignment...');
    
    const pythonProcess = spawn('python', ['autoAlign.py', vocalPath, instPath]);
    
    let pythonOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
        pythonOutput += data.toString();
    });
    
    pythonProcess.on('close', async (code) => {
        let delaySeconds = 0;
        try {
            const result = JSON.parse(pythonOutput.trim());
            if (result.success) {
                delaySeconds = result.delay_seconds;
                console.log(`[AutoMix] Alignment found! Vocal starts at ${delaySeconds.toFixed(2)}s`);
            } else {
                console.log(`[AutoMix] Alignment script returned error: ${result.error}. Defaulting to 0s.`);
            }
        } catch (e) {
            console.error(`[AutoMix] Failed to parse python output: ${pythonOutput}`);
        }
        
        // Clean up temp files
        fs.unlinkSync(vocalPath);
        fs.unlinkSync(instPath);

        // Generate Timeline State automatically
        const timelineState = {
            tracks: [
                {
                    id: 'track_inst',
                    name: 'Instrumental',
                    type: 'instrumental',
                    color: 'blue',
                    isMuted: false,
                    isSoloed: false,
                    volume: 1.0,
                    clips: [
                        {
                            id: 'clip_inst_1',
                            mediaId: instFile.originalname,
                            offset: 0,
                        }
                    ]
                },
                {
                    id: 'track_vocal',
                    name: 'Lead Vocal',
                    type: 'vocal',
                    color: 'rose',
                    isMuted: false,
                    isSoloed: false,
                    volume: 1.0,
                    clips: [
                        {
                            id: 'clip_voc_1',
                            mediaId: vocalFile.originalname,
                            offset: delaySeconds,
                        }
                    ]
                }
            ]
        };

        console.log('[AutoMix] Timeline generated, passing to MixEngine...');
        const mixStartTime = Date.now();
        
        timelineState.applyPitch = req.body.applyPitch === 'true';

        // Pass to existing mix engine
        const mixResult = await mixTracks([instFile, vocalFile], timelineState);
        
        const elapsed = ((Date.now() - mixStartTime) / 1000).toFixed(1);
        console.log(`[AutoMix] Mix complete in ${elapsed}s`);

        const mixedBase64 = `data:audio/wav;base64,${mixResult.mixedAudioBuffer.toString('base64')}`;

        return res.status(200).json({
          processed_audio_base64: mixedBase64,
          sections: mixResult.sections,
          globalSummary: mixResult.globalSummary,
          explanations: mixResult.explanations,
          automationData: mixResult.automationData,
          alignmentDelay: delaySeconds
        });
    });
}));

// ============================================================
// LEGACY: Single-track upload endpoint (kept for compatibility)
// ============================================================
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    console.log(`[Node] Received file: ${req.file.originalname}, Size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    // Return mock explanations for single-track mode
    return res.status(200).json({
      explanations: [
        { action: "Applied Low-Cut Filter at 40Hz", reason: "Excessive sub-frequency rumble detected below 40Hz.", tip: "Always use high-pass filters on non-bass instruments." },
        { action: "Dynamic EQ on Vocal Range", reason: "Harsh resonances found around 3kHz.", tip: "A dynamic EQ cuts narrow Q bands only when they become piercing." },
        { action: "RMS Leveling & True Peak Limiting", reason: "Track had highly dynamic peaks.", tip: "Set your True Peak Limiter ceiling to -1.0dBTP for streaming." }
      ]
    });
  } catch (error) {
    console.error('[Node] Error in /api/upload:', error.message);
    return res.status(500).json({
      error: 'Failed to process audio.',
      details: error.message,
    });
  }
});

// ============================================================
// NEW: Pitch Correction (VariAudio) Endpoint
// ============================================================
app.post('/api/pitch-correct', upload.single('file'), asyncHandler(async (req, res) => {
    console.log('\n--- New Pitch Correction Request ---');
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const snapStrength = parseFloat(req.body.snapStrength || 50);
    const timingStrength = parseFloat(req.body.timingStrength || 0);
    const formantPreserve = req.body.formantPreserve !== 'false';
    const analyzeOnly = req.body.analyzeOnly === 'true';

    console.log(`[PitchCorrect] File: ${req.file.originalname}, Snap: ${snapStrength}%, Timing: ${timingStrength}%, Formant: ${formantPreserve}`);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const inputPath = path.join(tempDir, `temp_pitch_in_${Date.now()}.wav`);
    fs.writeFileSync(inputPath, req.file.buffer);

    try {
        if (analyzeOnly) {
            // Just analyze pitch, don't correct
            const analysis = await analyzePitch(inputPath);
            fs.unlinkSync(inputPath);
            return res.status(200).json({
                success: true,
                analysis: {
                    segments: analysis.segments,
                    detectedKey: analysis.detectedKey,
                    duration: analysis.duration
                }
            });
        }

        // Full pitch + timing correction
        let currentPath = inputPath;
        const allExplanations = [];

        // Step 1: Pitch correction
        if (snapStrength > 0) {
            const pitchResult = await correctPitch(currentPath, { snapStrength, formantPreserve });
            allExplanations.push(...pitchResult.explanations);
            if (pitchResult.outputPath !== currentPath) {
                if (currentPath !== inputPath) fs.unlinkSync(currentPath);
                currentPath = pitchResult.outputPath;
            }
        }

        // Step 2: Timing correction
        if (timingStrength > 0) {
            const timingResult = await correctTiming(currentPath, { strength: timingStrength });
            allExplanations.push(...timingResult.explanations);
            if (timingResult.outputPath !== currentPath) {
                if (currentPath !== inputPath) fs.unlinkSync(currentPath);
                currentPath = timingResult.outputPath;
            }
        }

        // Read corrected audio
        const correctedBuffer = fs.readFileSync(currentPath);
        const correctedBase64 = `data:audio/wav;base64,${correctedBuffer.toString('base64')}`;

        // Analyze corrected pitch for comparison
        const correctedAnalysis = await analyzePitch(currentPath);

        // Cleanup
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (currentPath !== inputPath && fs.existsSync(currentPath)) fs.unlinkSync(currentPath);

        return res.status(200).json({
            success: true,
            processed_audio_base64: correctedBase64,
            explanations: allExplanations,
            analysis: {
                segments: correctedAnalysis.segments,
                detectedKey: correctedAnalysis.detectedKey,
                duration: correctedAnalysis.duration
            }
        });
    } catch (err) {
        console.error('[PitchCorrect] Error:', err.message);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return res.status(500).json({ error: 'Failed to process pitch correction: ' + err.message });
    }
}));

// ============================================================
// NEW: Multi-Track Audio Alignment Endpoint
// ============================================================
app.post('/api/align', upload.array('files'), asyncHandler(async (req, res) => {
    console.log('\n--- New Multi-Track Alignment Request ---');
    
    if (!req.files || req.files.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 files (1 reference + 1 target).' });
    }

    const referenceIndex = parseInt(req.body.referenceIndex || 0);
    console.log(`[Align] ${req.files.length} files, reference index: ${referenceIndex}`);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    // Write files to disk for Python processing
    const filePaths = [];
    for (let i = 0; i < req.files.length; i++) {
        const tempPath = path.join(tempDir, `temp_align_${i}_${Date.now()}.wav`);
        fs.writeFileSync(tempPath, req.files[i].buffer);
        filePaths.push(tempPath);
    }

    const referencePath = filePaths[referenceIndex];
    const targetPaths = filePaths.filter((_, i) => i !== referenceIndex);

    try {
        const pythonArgs = ['autoAlign.py', '--multi', referencePath, ...targetPaths];
        const pythonProcess = spawn('python', pythonArgs, { cwd: __dirname });

        let pythonOutput = '';
        let pythonError = '';

        pythonProcess.stdout.on('data', (data) => {
            pythonOutput += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            pythonError += data.toString();
        });

        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) reject(new Error(`Python exited with code ${code}: ${pythonError}`));
                else resolve();
            });
        });

        const result = JSON.parse(pythonOutput.trim());

        // Cleanup temp files
        filePaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        // Map results back to original file names
        const alignments = result.alignments.map((a, i) => ({
            ...a,
            originalName: req.files[i < referenceIndex ? i : i + 1]?.originalname || `Track ${i}`,
        }));

        // Generate XAI explanations
        const explanations = alignments.map(a => ({
            action: `Aligned "${a.originalName}": ${a.global_delay_ms > 0 ? '+' : ''}${a.global_delay_ms?.toFixed(1)}ms`,
            reason: `Cross-correlation detected this track is ${Math.abs(a.global_delay_ms || 0).toFixed(1)}ms ${(a.global_delay_ms || 0) > 0 ? 'behind' : 'ahead of'} the reference track. Confidence: ${((a.confidence || 0) * 100).toFixed(0)}%.`,
            tip: 'Audio alignment ensures all vocal layers hit at exactly the same time, creating a tight, professional-sounding performance.'
        }));

        return res.status(200).json({
            success: true,
            referenceFile: req.files[referenceIndex].originalname,
            alignments,
            explanations
        });
    } catch (err) {
        console.error('[Align] Error:', err.message);
        filePaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
        return res.status(500).json({ error: 'Alignment failed: ' + err.message });
    }
}));

// ============================================================
// NEW: BPM / Tempo Detection Endpoint
// ============================================================
app.post('/api/detect-bpm', upload.single('file'), asyncHandler(async (req, res) => {
    console.log('\n--- New BPM Detection Request ---');
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const inputPath = path.join(tempDir, `temp_bpm_${Date.now()}.wav`);
    fs.writeFileSync(inputPath, req.file.buffer);

    try {
        const pythonProcess = spawn('python', [path.join(__dirname, 'bpmDetect.py'), inputPath]);
        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (d) => { output += d.toString(); });
        pythonProcess.stderr.on('data', (d) => { errorOutput += d.toString(); });

        await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) reject(new Error(`BPM detection failed: ${errorOutput}`));
                else resolve();
            });
            pythonProcess.on('error', reject);
        });

        const result = JSON.parse(output.trim());
        
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

        return res.status(200).json(result);
    } catch (err) {
        console.error('[BPM] Error:', err.message);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return res.status(500).json({ error: 'BPM detection failed: ' + err.message });
    }
}));

// ============================================================
// NEW: AI Stem Splitter Endpoint
// ============================================================
const { splitStems } = require('./stemSplitter');

app.post('/api/split-stems', upload.single('file'), asyncHandler(async (req, res) => {
    console.log('\n--- New Stem Split Request ---');
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    console.log(`[StemSplit] File: ${req.file.originalname}, Size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const inputPath = path.join(tempDir, `temp_stem_in_${Date.now()}.wav`);
    fs.writeFileSync(inputPath, req.file.buffer);

    try {
        const outputDir = path.join(tempDir, `stems_${Date.now()}`);
        const result = await splitStems(inputPath, outputDir);

        // Convert each stem to base64
        const stemsBase64 = {};
        for (const [name, filePath] of Object.entries(result.stems)) {
            if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                stemsBase64[name] = `data:audio/wav;base64,${buffer.toString('base64')}`;
                fs.unlinkSync(filePath); // cleanup
            }
        }

        // Cleanup
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        // Remove output directory
        if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });

        return res.status(200).json({
            success: true,
            stems: stemsBase64,
            method: result.method,
            explanations: result.explanations
        });
    } catch (err) {
        console.error('[StemSplit] Error:', err.message);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return res.status(500).json({ error: 'Stem separation failed: ' + err.message });
    }
}));

app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`🚀 Node.js Backend listening on port ${port}`);
  console.log(`🎵 Multi-track mix endpoint: POST /api/mix`);
  console.log(`📁 Legacy upload endpoint:   POST /api/upload`);
  console.log(`🎼 Stem splitter endpoint:   POST /api/split-stems`);
  console.log(`=========================================`);
});

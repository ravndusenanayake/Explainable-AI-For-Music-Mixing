const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { mixTracks } = require('./mixEngine');

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

app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`🚀 Node.js Backend listening on port ${port}`);
  console.log(`🎵 Multi-track mix endpoint: POST /api/mix`);
  console.log(`📁 Legacy upload endpoint:   POST /api/upload`);
  console.log(`=========================================`);
});

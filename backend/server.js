const express = require('express');
const multer = require('multer');
const cors = require('cors');
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

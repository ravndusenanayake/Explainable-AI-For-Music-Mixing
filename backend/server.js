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

// ============================================================
// NEW: Multi-track mix endpoint
// Accepts two files: 'vocal' and 'instrumental'
// ============================================================
app.post('/api/mix', upload.fields([
  { name: 'vocal', maxCount: 1 },
  { name: 'instrumental', maxCount: 1 },
]), async (req, res) => {
  try {
    // Validate both files are present
    if (!req.files || !req.files.vocal || !req.files.instrumental) {
      const missing = [];
      if (!req.files?.vocal) missing.push('vocal');
      if (!req.files?.instrumental) missing.push('instrumental');
      return res.status(400).json({
        error: `Missing required track(s): ${missing.join(', ')}. Please upload both a vocal and an instrumental track.`,
      });
    }

    const vocalFile = req.files.vocal[0];
    const instrumentalFile = req.files.instrumental[0];

    console.log(`[Node] Received vocal: ${vocalFile.originalname} (${(vocalFile.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[Node] Received instrumental: ${instrumentalFile.originalname} (${(instrumentalFile.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log('[Node] Starting mix engine...');

    const startTime = Date.now();

    // Run the mixing engine
    const result = await mixTracks(vocalFile.buffer, instrumentalFile.buffer);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Node] Mix complete in ${elapsed}s`);

    // Convert mixed audio to base64 for transport
    const mixedBase64 = `data:audio/wav;base64,${result.mixedAudioBuffer.toString('base64')}`;

    return res.status(200).json({
      processed_audio_base64: mixedBase64,
      sections: result.sections,
      globalSummary: result.globalSummary,
      explanations: result.explanations,
    });

  } catch (error) {
    console.error('[Node] Error in /api/mix:', error.message);
    return res.status(500).json({
      error: 'Failed to process and mix tracks.',
      details: error.message,
    });
  }
});

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

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer setup - using memory storage for seamless forwarding
const upload = multer({ storage: multer.memoryStorage() });

// Defaulting to typical FastAPI local port, can be overridden via environment variables
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000/process';

app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    console.log(`[Node] Received file: ${req.file.originalname}, Size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    // Prepare FormData for Python service
    const formData = new FormData();
    formData.append('audio', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    console.log(`[Node] Forwarding to Python FastAPI service at ${PYTHON_SERVICE_URL}...`);

    // Call Python FastAPI service
    let pythonResponse;
    try {
      pythonResponse = await axios.post(PYTHON_SERVICE_URL, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      console.log('[Node] Successfully received response from Python service.');
      return res.status(200).json(pythonResponse.data);
    } catch (pythonError) {
      console.warn('[Node] Python service unreachable. Returning empty response to trigger frontend mock data fallback.');
      // Return 200 with empty data so the frontend uses its mock data
      return res.status(200).json({});
    }

  } catch (error) {
    console.error('[Node] Error in /api/upload:', error.message);
    
    return res.status(500).json({
      error: 'Failed to process audio.',
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`🚀 Node.js Backend listening on port ${port}`);
  console.log(`🔗 Pointing to Python API at: ${PYTHON_SERVICE_URL}`);
  console.log(`=========================================`);
});

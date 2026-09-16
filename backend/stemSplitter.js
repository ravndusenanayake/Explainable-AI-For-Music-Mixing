/**
 * stemSplitter.js
 * AI Stem Separation Engine
 * Uses FFmpeg audio filters for basic stem separation.
 * Can be upgraded to use Meta's Demucs for high-quality AI separation.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Split an audio file into vocal and instrumental stems using FFmpeg.
 * This uses center-channel extraction for vocal isolation (pan-based).
 * For production use, upgrade to Demucs (Meta AI) for ML-based separation.
 * 
 * @param {string} inputPath - Path to the input audio file
 * @param {string} outputDir - Directory to write output stems
 * @returns {Object} { stems: { vocals, drums, bass, other }, explanations }
 */
async function splitStems(inputPath, outputDir) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const baseName = path.basename(inputPath, path.extname(inputPath));

  // Check if demucs is available
  const useDemucs = await isDemucsAvailable();

  if (useDemucs) {
    return await splitWithDemucs(inputPath, outputDir, baseName);
  } else {
    return await splitWithFFmpeg(inputPath, outputDir, baseName);
  }
}

/**
 * Check if Python demucs is available
 */
function isDemucsAvailable() {
  return new Promise((resolve) => {
    const proc = spawn('python', ['-c', 'import demucs; print("ok")']);
    let out = '';
    proc.stdout.on('data', (d) => out += d.toString());
    proc.on('close', (code) => resolve(code === 0 && out.includes('ok')));
    proc.on('error', () => resolve(false));
    // Timeout after 5s
    setTimeout(() => { try { proc.kill(); } catch(e) {} resolve(false); }, 5000);
  });
}

/**
 * High-quality stem separation using Meta's Demucs (htdemucs model)
 */
async function splitWithDemucs(inputPath, outputDir, baseName) {
  console.log('[StemSplitter] Using Demucs AI model for high-quality separation...');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('python', [
      '-m', 'demucs',
      '--two-stems=vocals',   // Split into vocals + no_vocals
      '-n', 'htdemucs',       // Use the hybrid transformer model
      '-o', outputDir,
      inputPath
    ]);

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[StemSplitter] Demucs failed:', stderr);
        return reject(new Error('Demucs separation failed'));
      }

      // Demucs outputs to: outputDir/htdemucs/<filename>/vocals.wav & no_vocals.wav
      const demucsDir = path.join(outputDir, 'htdemucs', baseName);
      const vocalsPath = path.join(demucsDir, 'vocals.wav');
      const noVocalsPath = path.join(demucsDir, 'no_vocals.wav');

      // Copy to standard output names
      const stems = {};
      if (fs.existsSync(vocalsPath)) {
        const dest = path.join(outputDir, `${baseName}_vocals.wav`);
        fs.copyFileSync(vocalsPath, dest);
        stems.vocals = dest;
      }
      if (fs.existsSync(noVocalsPath)) {
        const dest = path.join(outputDir, `${baseName}_instrumental.wav`);
        fs.copyFileSync(noVocalsPath, dest);
        stems.instrumental = dest;
      }

      resolve({
        stems,
        method: 'demucs',
        explanations: [
          {
            action: 'AI Stem Separation Complete',
            reason: 'Used Meta Demucs (Hybrid Transformer) AI model for high-quality source separation.',
            tip: 'Demucs provides studio-quality separation. Each stem can now be mixed independently.'
          }
        ]
      });
    });

    proc.on('error', reject);
  });
}

/**
 * Basic stem separation using FFmpeg filters (center-channel extraction).
 * Not as good as Demucs, but works without ML dependencies.
 */
async function splitWithFFmpeg(inputPath, outputDir, baseName) {
  console.log('[StemSplitter] Using FFmpeg filter-based separation...');

  const vocalsPath = path.join(outputDir, `${baseName}_vocals.wav`);
  const instrumentalPath = path.join(outputDir, `${baseName}_instrumental.wav`);
  const bassPath = path.join(outputDir, `${baseName}_bass.wav`);
  const treblePath = path.join(outputDir, `${baseName}_treble.wav`);

  // Extract center channel (where vocals typically sit in a stereo mix)
  // and create an inverted version for instrumental
  await runFFmpeg(inputPath, vocalsPath, [
    '-af', 'pan=mono|c0=c0-c1,aformat=channel_layouts=stereo'
  ]);

  // Instrumental = Original - Center (side channels)
  await runFFmpeg(inputPath, instrumentalPath, [
    '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0,aformat=channel_layouts=stereo'
  ]);

  // Bass = Low frequencies only (< 250Hz)
  await runFFmpeg(inputPath, bassPath, [
    '-af', 'lowpass=f=250,aformat=channel_layouts=stereo'
  ]);

  // Treble = High frequencies only (> 4000Hz)
  await runFFmpeg(inputPath, treblePath, [
    '-af', 'highpass=f=4000,aformat=channel_layouts=stereo'
  ]);

  return {
    stems: {
      vocals: vocalsPath,
      instrumental: instrumentalPath,
      bass: bassPath,
      treble: treblePath
    },
    method: 'ffmpeg',
    explanations: [
      {
        action: 'Stem Separation Complete (Basic)',
        reason: 'Used FFmpeg center-channel extraction. Vocals are isolated from the center of the stereo field.',
        tip: 'For better quality, install Python demucs: pip install demucs'
      }
    ]
  };
}

function runFFmpeg(input, output, extraArgs) {
  return new Promise((resolve, reject) => {
    const args = ['-i', input, ...extraArgs, '-y', output];
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`FFmpeg failed: ${stderr.slice(-200)}`));
      else resolve();
    });
    proc.on('error', reject);
  });
}

module.exports = { splitStems };

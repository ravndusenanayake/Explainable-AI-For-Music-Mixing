const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

function createTestWav(durationSec = 2, sampleRate = 44100) {
  const numSamples = durationSec * sampleRate;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 30);
  buffer.writeUInt16LE(bitsPerSample, 32);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

const inputBuffer = createTestWav(2);
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const tempIn = path.join(tempDir, `in_${Date.now()}.tmp`);
const tempOut = path.join(tempDir, `out_${Date.now()}.wav`);

fs.writeFileSync(tempIn, inputBuffer);

console.log("tempIn:", tempIn);
console.log("tempOut:", tempOut);

ffmpeg(tempIn)
  .format('wav')
  .audioCodec('pcm_s16le')
  .audioFrequency(44100)
  .audioChannels(1)
  .on('error', (err, stdout, stderr) => {
    console.error('Error:', err.message);
    console.error('FFmpeg stderr:', stderr);
  })
  .on('end', () => console.log('Success'))
  .save(tempOut);

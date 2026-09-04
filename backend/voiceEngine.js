const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Converts a voice recording into a different style using advanced FFmpeg DSP chains.
 * @param {string} inputPath - Path to the original audio file
 * @param {string} style - The target style ('rock', 'deep', 'chipmunk')
 * @returns {Promise<string>} - Path to the converted audio file
 */
const convertVoiceStyle = (inputPath, style) => {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(__dirname, 'temp', `converted_${style}_${Date.now()}.wav`);
        
        let filterChain = [];

        switch (style) {
            case 'rock':
                // Rock: Overdrive (distortion), slight pitch down to add grit, chorus, and heavy compression
                // asetrate changes pitch and sample rate, aresample fixes sample rate back
                filterChain = [
                    'asetrate=44100*0.95', // Pitch down slightly (grit)
                    'aresample=44100', // Resample back
                    'atempo=1/0.95', // Correct the tempo change caused by asetrate
                    'chorus=0.5:0.9:50|60:0.4|0.32:0.25|0.4:2|2.3', // Width
                    'acompressor=threshold=-20dB:ratio=6:attack=5:release=50:makeup=5', // Heavy compression
                    'highpass=f=200', // Cut mud
                    'lowpass=f=8000', // Cut extreme highs
                    'volume=2.0' // Boost because of filtering
                ];
                break;
            case 'deep':
                // Deep voice: Pitch down by a lot
                filterChain = [
                    'asetrate=44100*0.75', // Pitch down significantly
                    'aresample=44100',
                    'atempo=1/0.75', // Correct tempo
                    'highpass=f=80' // Keep bass but remove rumble
                ];
                break;
            case 'chipmunk':
                // High pitch
                filterChain = [
                    'asetrate=44100*1.5', // Pitch up significantly
                    'aresample=44100',
                    'atempo=1/1.5' // Correct tempo
                ];
                break;
            default:
                // No effect
                filterChain = ['volume=1.0'];
                break;
        }

        ffmpeg(inputPath)
            .audioFilters(filterChain)
            .toFormat('wav')
            .on('end', () => {
                console.log(`[VoiceEngine] Successfully converted to ${style} style.`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`[VoiceEngine] Error converting voice: ${err.message}`);
                reject(err);
            })
            .save(outputPath);
    });
};

module.exports = {
    convertVoiceStyle
};

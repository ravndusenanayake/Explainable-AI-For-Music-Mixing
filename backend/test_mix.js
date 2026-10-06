const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function test() {
    try {
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

        const timelineState = {
            tracks: [
                { id: 't1', name: 'Lead Vocal', type: 'vocal', color: 'rose', clips: [
                    { id: 'c1', mediaId: 'm1', startTime: 0, startOffset: 0, duration: 2 }
                ], pan: 0, volume: 1, isMuted: false, isSoloed: false, effects: JSON.parse(JSON.stringify(defaultEffects)) },
            ],
            mediaPool: [
                { id: 'm1', name: 'test.wav' }
            ]
        };

        const formData = new FormData();
        // create a dummy wav file
        const dummyWav = Buffer.from('RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00', 'binary');
        fs.writeFileSync('test.wav', dummyWav);
        formData.append('files', fs.createReadStream('test.wav'), 'm1_test.wav');
        formData.append('timelineState', JSON.stringify(timelineState));

        console.log('Sending request...');
        const res = await axios.post('http://localhost:5000/api/mix', formData, {
            headers: formData.getHeaders()
        });

        console.log('Response Status:', res.status);
        console.log('updatedTracks:', JSON.stringify(res.data.updatedTracks, null, 2));

    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}
test();

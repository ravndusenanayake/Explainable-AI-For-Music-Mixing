require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // We will test some models that we know are in the list
    const modelsToTest = [
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-flash-lite-latest'
    ];
    
    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello! Are you working?");
            console.log(`✅ ${modelName} works! Response:`, result.response.text());
        } catch (e) {
            console.log(`❌ ${modelName} failed:`, e.message);
        }
    }
}

test();

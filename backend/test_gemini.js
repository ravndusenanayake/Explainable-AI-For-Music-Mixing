require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const key = process.env.GEMINI_API_KEY;
    console.log("Using API Key starting with:", key.substring(0, 5));
    const genAI = new GoogleGenerativeAI(key);
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const result = await model.generateContent("Hello!");
        console.log("Success:", result.response.text());
    } catch (error) {
        console.error(error);
    }
}

test();

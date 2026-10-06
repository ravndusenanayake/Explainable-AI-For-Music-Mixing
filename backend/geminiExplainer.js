require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

async function generateMixExplanation(mixContext) {
    if (!genAI) {
        console.warn("[GeminiExplainer] No GEMINI_API_KEY found. Returning original explanations.");
        return mixContext.originalExplanations;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

        const prompt = `
You are an expert audio engineer and Explainable AI for a professional music mixing system.
Based on the following mixing statistics, track data, and basic automated decisions made by the system, generate a comprehensive set of professional explanations for the user.

Your response MUST be a valid JSON object with exactly this structure:
{
  "overallSummary": "A friendly, easy-to-understand summary of the mix. Explain what was generally done to the tracks (e.g., 'Your track had some dynamic vocals, so I smoothed them out and balanced the instruments to give it a professional shine.') Do NOT include robotic stats like 'Analyzed 59 sections'. Make it sound like a real sound engineer talking.",
  "explanations": [
    {
      "action": "Brief title of the action (e.g., 'Dynamic EQ on Lead Vocal')",
      "reason": "Detailed but concise reason why this decision was made based on the data, explaining the audio engineering principles.",
      "tip": "A professional mixing tip related to this action for the user to learn from.",
      "section": "The section name or 'Global'",
      "time": "Time range or 'Entire Track'",
      "sectionType": "Type of processing (e.g., 'EQ', 'Dynamics', 'Volume', 'Global')"
    }
  ]
}

Provide 4 to 6 insightful explanations in the array. Make them sound like a professional mastering/mixing engineer explaining their thought process.
CRITICAL: You MUST write all the text values (overallSummary, action, reason, tip, etc.) in Sinhala script (සිංහල අකුරෙන්) to make it highly localized for Sri Lankan users. Keep the JSON keys in English. Do NOT include markdown blocks like \`\`\`json, just output the raw JSON object.

Mix Context Data:
${JSON.stringify(mixContext, null, 2)}
`;

        console.log("[GeminiExplainer] Requesting explanations from Gemini Pro...");
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean up markdown formatting if Gemini returns ```json ... ```
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonResponse = JSON.parse(cleanedText);
        console.log("[GeminiExplainer] Successfully generated dynamic explanations.");
        return jsonResponse;
    } catch (error) {
        console.error("[GeminiExplainer] Error generating Gemini explanation:", error);
        return mixContext.originalExplanations; // Fallback
    }
}

async function generateChatResponse(message, history, mixContext) {
    if (!genAI) {
        return "I'm sorry, but the Gemini API key is not configured. Please add it to the .env file to use the AI chat assistant.";
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

        let systemInstruction = `You are a professional audio mixing engineer and an AI assistant for a music mixing web application.
The user is asking you questions about their mix, audio engineering concepts, or how to fix issues in their track.
Answer concisely, professionally, and in a friendly manner.

CRITICAL INSTRUCTION FOR LANGUAGE:
You MUST fully support the Sinhala language. If the user asks their question in Sinhala (using Sinhala script) or Singlish (Sinhala words typed in English letters), you MUST reply in the EXACT same language format (Sinhala script or Singlish). Be very helpful and conversational.

Here is the current context of the user's mix (stats, explanations, and decisions made by the system):
${mixContext ? JSON.stringify(mixContext) : "No mix context available yet."}
`;

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemInstruction }] },
                { role: "model", parts: [{ text: "Understood. I'm ready to help with the mix." }] },
                ...history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                }))
            ]
        });

        const result = await chat.sendMessage(message);
        return result.response.text();
    } catch (error) {
        console.error("[GeminiExplainer] Error generating chat response:", error);
        return "Sorry, I encountered an error while trying to generate a response. Please check the backend logs.";
    }
}

module.exports = { generateMixExplanation, generateChatResponse };

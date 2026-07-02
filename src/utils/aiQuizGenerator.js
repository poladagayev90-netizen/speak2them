import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export const generateQuizFromWords = async (translatedItems) => {
  if (!translatedItems || translatedItems.length === 0) return null;
  if (!apiKey) {
    console.error("Gemini API key is missing");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Ensure we take up to 5 random words from the translated items
    const sampleSize = Math.min(translatedItems.length, 5);
    const shuffled = [...translatedItems].sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, sampleSize);

    const wordsList = selectedItems.map(w => `'${w.original}' (translated to '${w.translated}')`).join(', ');

    const prompt = `
      You are an English language teacher for an Azerbaijani student.
      The student has just learned the following English words/phrases during a conversation:
      ${wordsList}

      Generate a quick multiple-choice quiz (1 question per word) to test their memory.
      The questions must be in Azerbaijani. The options can be either in English or Azerbaijani depending on what is being asked.
      
      Return ONLY a valid JSON array of objects with the following format (no markdown code blocks, just raw JSON):
      [
        {
          "qText": "Question text in Azerbaijani",
          "options": ["Option 1", "Option 2", "Option 3"],
          "correctIdx": 0
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean up potential markdown formatting in case the model ignored instructions
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error generating AI quiz:", error);
    return null;
  }
};

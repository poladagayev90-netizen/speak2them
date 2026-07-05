export const generateQuizFromWords = async (translatedItems) => {
  if (!translatedItems || translatedItems.length === 0) return null;

  const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("DeepSeek API key (REACT_APP_DEEPSEEK_API_KEY) not found in frontend env.");
    return { error: 'Süni İntellekt açarı tapılmadı.' };
  }

  try {
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
      
      Return ONLY a valid JSON object with a "quiz" key containing an array of questions. Format:
      {
        "quiz": [
          {
            "qText": "Question text in Azerbaijani",
            "options": ["Option 1", "Option 2", "Option 3"],
            "correctIdx": 0
          }
        ]
      }
    `;

    const deepseekRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!deepseekRes.ok) {
      const err = await deepseekRes.text().catch(()=>(''));
      console.error("DeepSeek API Error (Frontend):", err);
      return { error: `Süni İntellekt serverində xəta baş verdi (DeepSeek: ${deepseekRes.status})` };
    }

    const data = await deepseekRes.json();
    let responseText = data.choices[0].message.content;
    
    // Clean markdown if present
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    
    // Process exactly like frontend did
    let quizData = parsed;
    if (!Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
            quizData = parsed[keys[0]];
        }
    }

    return quizData;

  } catch (error) {
    console.error("Error generating AI quiz:", error);
    return { error: error.message || "Tərcümə edilərkən xəta baş verdi" };
  }
};

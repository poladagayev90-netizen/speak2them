const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;

export const generateQuizFromWords = async (translatedItems) => {
  if (!translatedItems || translatedItems.length === 0) return null;
  if (!apiKey) {
    console.error("DeepSeek API key is missing");
    return { error: "DeepSeek API açarı tapılmadı." };
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

    const res = await fetch("https://api.deepseek.com/chat/completions", {
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

    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      console.error("DeepSeek API Error:", err);
      return { error: `Süni İntellekt serverində xəta baş verdi (DeepSeek: ${res.status})` };
    }

    const data = await res.json();
    let responseText = data.choices[0].message.content;
    
    // Fallback cleanup if OpenAI wrapped in markdown (though JSON mode usually prevents it)
    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // GPT might return an object with a key like { "quiz": [...] } when forced to json_object
    const parsed = JSON.parse(cleanedText);
    
    if (Array.isArray(parsed)) return parsed;
    
    // If it returned { "questions": [...] } or something similar
    const keys = Object.keys(parsed);
    if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
      return parsed[keys[0]];
    }

    return { error: "Gözlənilməz cavab formatı." };

  } catch (error) {
    console.error("Error generating AI quiz:", error);
    return { error: error.message || "Tərcümə edilərkən xəta baş verdi" };
  }
};

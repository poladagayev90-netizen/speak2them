module.exports = async function handler(req, res) {
  // CORS setup if needed
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcript, vocabList, idiomList } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Missing transcript' });
    }

    const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'DeepSeek API key not configured on server' });
    }

    const prompt = `You are an expert EFL (English as a Foreign Language) tutor.
Analyze this spoken transcript of an English practice conversation (transcribed by Web Speech API, so it may have slight transcription errors).

Transcript: "${transcript}"

Today's topic vocabulary words: ${vocabList || 'None'}
Today's idioms: ${idiomList || 'None'}

Analyze the conversation and return ONLY a valid JSON object with NO extra text, NO markdown, NO backticks:
{
  "transcript": "brief summary of what the user discussed (2-3 sentences)",
  "grammarFixes": [
    { "original": "exact wrong phrase heard", "corrected": "correct version", "explanation": "brief reason" }
  ],
  "vocabularyUsed": ["list of today's topic words actually used by the user"],
  "idiomBonus": true or false,
  "fluencyScore": number 0-100 based on sentence completeness and flow,
  "talkRatio": number 0-100 representing how much the speaker talked,
  "overallScore": number 0-100 weighted average,
  "encouragement": "one specific encouraging sentence about what went well"
}
Limit grammarFixes to maximum 3 most important errors. 
If the user didn't speak English or it's unintelligible, return low scores and explain in encouragement.
Return ONLY the JSON object. Nothing else.`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content.trim();
    
    // Remove markdown code blocks if any
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }

    const analysisObj = JSON.parse(resultText);

    return res.status(200).json({ analysis: analysisObj });
  } catch (error) {
    console.error('Call Analysis Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

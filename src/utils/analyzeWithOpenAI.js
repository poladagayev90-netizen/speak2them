import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayContent } from '../data/weeklyContent';

export async function analyzeCallAudio(transcript, userId, channelName) {
  try {
    if (!transcript || transcript.trim().length < 10) {
      console.warn('[DeepSeek] Transcript too short, skipping analysis');
      return null;
    }

    const user = auth.currentUser;
    if (!user) throw new Error("İstifadəçi tapılmadı");

    const today = getTodayContent();
    const vocabList = today.vocabulary.map(v => v.word).join(', ');
    const idiomList = today.idioms.map(i => i.phrase).join(', ');

    const apiKey = process.env.REACT_APP_DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("API Key eksikdir!");

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

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      const errData = await res.text().catch(() => '');
      throw new Error('API Xətası: ' + res.status + ' ' + errData);
    }

    const data = await res.json();
    let resultText = data.choices[0].message.content.trim();
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }

    const analysis = JSON.parse(resultText);

    // Save to Firestore
    const docId = `${userId}_${channelName}`;
    await setDoc(doc(db, 'callAnalysis', docId), {
      ...analysis,
      userId,
      channelName,
      analyzedAt: serverTimestamp()
    });

    console.log('[OpenAI] Analysis saved to Firestore:', docId);
    return analysis;

  } catch (error) {
    console.error('[OpenAI] Analysis failed:', error);
    try {
      const docId = `${userId}_${channelName}`;
      await setDoc(doc(db, 'callAnalysis', docId), {
        error: error.message || 'Unknown error occurred',
        userId,
        channelName,
        analyzedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('[OpenAI] Failed to save error to Firestore:', e);
    }
    return null;
  }
}

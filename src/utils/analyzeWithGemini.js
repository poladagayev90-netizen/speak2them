import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayContent } from '../data/weeklyContent';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function analyzeCallAudio(audioBlob, userId, channelName) {
  try {
    // 1. Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);

    // 2. Get today's vocab and idioms
    const today = getTodayContent();
    const vocabList = today.vocabulary.map(v => v.word).join(', ');
    const idiomList = today.idioms.map(i => i.phrase).join(', ');

    // 3. Build Gemini prompt
    const prompt = `
You are an EFL (English as a Foreign Language) tutor.
Listen to this audio recording of an English speaking practice session.

Today's topic vocabulary words: ${vocabList}
Today's idioms: ${idiomList}

Analyze the speech and return ONLY a valid JSON object with NO extra text, NO markdown, NO backticks:
{
  "transcript": "full transcript of what was said",
  "grammarFixes": [
    { "original": "wrong phrase", "corrected": "correct phrase", "explanation": "brief reason" }
  ],
  "vocabularyUsed": ["list of topic words actually used from the provided list"],
  "idiomBonus": true or false,
  "fluencyScore": number 0-100,
  "talkRatio": number 0-100,
  "overallScore": number 0-100,
  "encouragement": "one specific positive sentence"
}
Return only the JSON object. Nothing else.`;

    // 4. Call Gemini API
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'audio/webm', data: base64Audio } }
          ]
        }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const analysis = JSON.parse(rawText.replace(/```json|```/g, '').trim());

    // 5. Save to Firestore
    await setDoc(doc(db, 'callAnalysis', `${userId}_${channelName}`), {
      ...analysis,
      userId,
      channelName,
      analyzedAt: serverTimestamp()
    });

    return analysis;

  } catch (error) {
    console.error('Gemini analysis failed:', error);
    return null;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

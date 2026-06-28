import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayContent } from '../data/weeklyContent';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function analyzeCallAudio(audioBlob, userId, channelName) {
  try {
    if (!audioBlob || audioBlob.size < 100) {
      console.warn('[Gemini] Audio blob too small, skipping analysis');
      return null;
    }

    // Convert blob to base64
    const base64Audio = await blobToBase64(audioBlob);

    // Get today's vocab and idioms
    const today = getTodayContent();
    const vocabList = today.vocabulary.map(v => v.word).join(', ');
    const idiomList = today.idioms.map(i => i.phrase).join(', ');

    const prompt = `You are an expert EFL (English as a Foreign Language) tutor.
Listen to this audio recording of an English speaking practice conversation between two learners.

Today's topic vocabulary words: ${vocabList}
Today's idioms: ${idiomList}

Analyze the conversation and return ONLY a valid JSON object with NO extra text, NO markdown, NO backticks:
{
  "transcript": "brief summary of what was discussed (2-3 sentences)",
  "grammarFixes": [
    { "original": "exact wrong phrase heard", "corrected": "correct version", "explanation": "brief reason" }
  ],
  "vocabularyUsed": ["list of today's topic words actually used in the conversation"],
  "idiomBonus": true or false,
  "fluencyScore": number 0-100 based on sentence completeness and flow,
  "talkRatio": number 0-100 representing how much the main speaker talked,
  "overallScore": number 0-100 weighted average,
  "encouragement": "one specific encouraging sentence about what went well"
}
Limit grammarFixes to maximum 3 most important errors.
Return only the JSON object. Nothing else.`;

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: audioBlob.type || 'audio/webm',
                data: base64Audio
              }
            }
          ]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Gemini API error: ' + err);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('No response from Gemini');

    const clean = rawText.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

    // Save to Firestore
    const docId = `${userId}_${channelName}`;
    await setDoc(doc(db, 'callAnalysis', docId), {
      ...analysis,
      userId,
      channelName,
      analyzedAt: serverTimestamp()
    });

    console.log('[Gemini] Analysis saved to Firestore:', docId);
    return analysis;

  } catch (error) {
    console.error('[Gemini] Analysis failed:', error);
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

import { db, auth } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayContent } from '../data/weeklyContent';
import { FUNCTIONS_BASE } from '../constants';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result.split(',')[1];
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function analyzeCallAudio(audioBlob, userId, channelName) {
  try {
    if (!audioBlob || audioBlob.size < 100) {
      console.warn('[OpenAI] Audio blob too small, skipping analysis');
      return null;
    }

    const user = auth.currentUser;
    if (!user) throw new Error("İstifadəçi tapılmadı");
    const token = await user.getIdToken();

    const base64Audio = await blobToBase64(audioBlob);

    const today = getTodayContent();
    const vocabList = today.vocabulary.map(v => v.word).join(', ');
    const idiomList = today.idioms.map(i => i.phrase).join(', ');

    const prompt = `You are an expert EFL (English as a Foreign Language) tutor.
Analyze this transcript of an English speaking practice conversation between two learners.

Transcript: "{{TRANSCRIPT}}"

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

    const res = await fetch(`${FUNCTIONS_BASE}/analyzeCallOpenAI`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ base64Audio, prompt })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Backend Xətası: ' + res.status);
    }

    const data = await res.json();
    const analysis = data.analysis;

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

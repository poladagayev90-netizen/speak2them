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

export async function analyzeCallAudio(transcript, userId, channelName) {
  try {
    if (!transcript || transcript.trim().length < 10) {
      console.warn('[DeepSeek] Transcript too short, skipping analysis');
      return null;
    }

    const user = auth.currentUser;
    if (!user) throw new Error("İstifadəçi tapılmadı");
    const token = await user.getIdToken();

    const today = getTodayContent();
    const vocabList = today.vocabulary.map(v => v.word).join(', ');
    const idiomList = today.idioms.map(i => i.phrase).join(', ');

    const res = await fetch(`/api/analyze-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ transcript, vocabList, idiomList })
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

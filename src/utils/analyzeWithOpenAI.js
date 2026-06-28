import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getTodayContent } from '../data/weeklyContent';

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

export async function analyzeCallAudio(audioBlob, userId, channelName) {
  try {
    if (!audioBlob || audioBlob.size < 100) {
      console.warn('[OpenAI] Audio blob too small, skipping analysis');
      return null;
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API Key is missing. Please add REACT_APP_OPENAI_API_KEY to Vercel.");
    }

    // Step 1: Transcribe audio using Whisper
    const formData = new FormData();
    // OpenAI requires a filename with an extension they support (like .webm)
    formData.append('file', audioBlob, 'audio.webm'); 
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // assuming English practice

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!whisperResponse.ok) {
      const err = await whisperResponse.text();
      throw new Error('Whisper API error: ' + err);
    }

    const whisperData = await whisperResponse.json();
    const transcript = whisperData.text;

    if (!transcript || transcript.trim() === '') {
      throw new Error('Could not hear any speech in the audio.');
    }

    // Step 2: Analyze transcript using GPT-4o-mini
    const today = getTodayContent();
    const vocabList = today.vocabulary.map(v => v.word).join(', ');
    const idiomList = today.idioms.map(i => i.phrase).join(', ');

    const prompt = `You are an expert EFL (English as a Foreign Language) tutor.
Analyze this transcript of an English speaking practice conversation between two learners.

Transcript: "${transcript}"

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

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    if (!chatResponse.ok) {
      const err = await chatResponse.text();
      throw new Error('GPT API error: ' + err);
    }

    const chatData = await chatResponse.json();
    const rawText = chatData.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('No response from GPT');

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

import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';

// Speaking a FIXED line — the question that opens each picture.
//
// These strings never change, so their audio is synthesised once and kept. The
// first learner to hear "What can you see in this picture?" pays for one TTS
// call; everybody after that, on that device, pays nothing. That is what makes
// it affordable to have AInur actually ASK the question out loud instead of
// only printing it, which is the difference between a learner who knows what to
// do and one staring at a photo.
const MEM = new Map();
const KEY = (text) => `ainur_tts_v1:${text}`;
let current = null;

function play(base64) {
  if (current) { current.pause(); current = null; }
  const el = new Audio(`data:audio/mp3;base64,${base64}`);
  current = el;
  el.onended = () => { if (current === el) current = null; };
  el.play().catch(() => { if (current === el) current = null; });
}

export async function speakLine(text) {
  if (!text) return;

  const mem = MEM.get(text);
  if (mem) { play(mem); return; }

  try {
    const stored = localStorage.getItem(KEY(text));
    if (stored) { MEM.set(text, stored); play(stored); return; }
  } catch {
    // storage unavailable (private mode) — fall through and fetch
  }

  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(`${FUNCTIONS_BASE}/speakLine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const { audioBase64 } = await res.json();
    if (!audioBase64) return;
    MEM.set(text, audioBase64);
    // Best effort: a full quota must never break the lesson.
    try { localStorage.setItem(KEY(text), audioBase64); } catch { /* ignore */ }
    play(audioBase64);
  } catch {
    // A silent question is a degraded lesson, not a broken one — it is on screen.
  }
}

export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
}

export default speakLine;

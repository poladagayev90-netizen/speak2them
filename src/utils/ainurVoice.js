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
let endCurrent = null;   // settles the promise for whatever is playing right now

// A ceiling on how long a caller will wait for one line. A line is a single
// sentence; if it has not finished by now something is wrong -- autoplay was
// blocked, or the decode stalled -- and a learner staring at a dead microphone
// button is a worse failure than a missing voice.
const MAX_LINE_MS = 9000;

// Resolves when she has STOPPED TALKING, not when playback began. Callers open
// the microphone on that promise, so getting this wrong means recording her.
function play(base64) {
  stopSpeaking();
  const el = new Audio(`data:audio/mp3;base64,${base64}`);
  current = el;
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (current === el) { current = null; endCurrent = null; }
      resolve();
    };
    const timer = setTimeout(finish, MAX_LINE_MS);
    endCurrent = finish;
    el.onended = finish;
    el.onerror = finish;
    el.play().catch(finish);
  });
}

export async function speakLine(text) {
  if (!text) return;

  const mem = MEM.get(text);
  if (mem) { await play(mem); return; }

  try {
    const stored = localStorage.getItem(KEY(text));
    if (stored) { MEM.set(text, stored); await play(stored); return; }
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
    await play(audioBase64);
  } catch {
    // A silent question is a degraded lesson, not a broken one — it is on screen.
  }
}

// Cutting her off also SETTLES the pending promise. Without that, a learner who
// skipped the line would wait out the whole ceiling before the microphone
// opened -- the skip button would look broken.
export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
  if (endCurrent) { const settle = endCurrent; endCurrent = null; settle(); }
}

export default speakLine;

import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';

// Speaking a FIXED line — the one sentence AInur says out loud when a session
// opens.
//
// These strings never change, so the audio is synthesised once and kept. The
// first learner to hear it pays for one TTS call; everybody after that, on that
// device, pays nothing.
//
// TWO RULES, both learned the hard way:
//
// 1. THE VOICE IS NEVER ON THE CRITICAL PATH. `primeLine` fetches the audio
//    when the screen opens, so by the time the learner taps, playback is
//    instant. A tap must never wait on a network round trip before the
//    microphone opens — the lesson is the microphone, the voice is a nicety.
//
// 2. A REFUSED LINE IS A BUG AND MUST BE LOUD. The server keeps an allowlist
//    (SPEAKABLE_LINES in functions/index.js). Asking for a line that is not on
//    it returns 400 and, when that was swallowed, AInur went completely silent
//    with nothing on screen explaining why — the activity looked broken and the
//    cause was invisible. It now reports.
const MEM = new Map();
// In-flight fetches, keyed by line. Without this, priming on mount and a tap a
// moment later fire two identical paid TTS requests for the same sentence.
const PENDING = new Map();
const KEY = (text) => `ainur_tts_v1:${text}`;
let current = null;
let endCurrent = null;   // settles the promise for whatever is playing right now

// A ceiling on how long a caller will wait for one line. A line is a single
// sentence; if it has not finished by now something is wrong — autoplay was
// blocked, or the decode stalled — and a learner staring at a dead microphone
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

function readCache(text) {
  if (MEM.has(text)) return MEM.get(text);
  try {
    const stored = localStorage.getItem(KEY(text));
    if (stored) { MEM.set(text, stored); return stored; }
  } catch {
    // storage unavailable (private mode) — memory only
  }
  return null;
}

/** Is this line already on the device, ready to play with no network? */
export function hasLine(text) {
  return !!text && !!readCache(text);
}

/**
 * Fetch and cache a line WITHOUT playing it. Call this when the screen opens.
 * Safe to call repeatedly; it is a no-op once the line is cached.
 */
export function primeLine(text) {
  if (!text || readCache(text)) return Promise.resolve(null);
  if (PENDING.has(text)) return PENDING.get(text);
  const job = fetchLine(text).finally(() => PENDING.delete(text));
  PENDING.set(text, job);
  return job;
}

async function fetchLine(text) {
  // Auth restores from IndexedDB asynchronously, so a prime fired on mount can
  // land before there is a user to get a token from. Bail quietly and let the
  // caller try again — nothing is cached on failure, so a retry is free.
  if (!auth.currentUser) return null;
  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(`${FUNCTIONS_BASE}/speakLine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      // 400 here means the line is not on the server allowlist — a code bug,
      // not a runtime condition. Never let it pass quietly.
      console.error(
        `[ainurVoice] speakLine refused (${res.status}) for: "${text}". ` +
        'If this is 400, add the line to SPEAKABLE_LINES in functions/index.js.',
      );
      return null;
    }
    const { audioBase64 } = await res.json();
    if (!audioBase64) return null;
    MEM.set(text, audioBase64);
    // Best effort: a full quota must never break the lesson.
    try { localStorage.setItem(KEY(text), audioBase64); } catch { /* ignore */ }
    return audioBase64;
  } catch {
    // Offline, or auth not ready. The line stays unspoken; the lesson goes on.
    return null;
  }
}

/**
 * Say a line and resolve when she has finished. Falls back to fetching if the
 * line was never primed, so a caller that skipped `primeLine` still works —
 * it just waits longer.
 */
export async function speakLine(text) {
  if (!text) return;
  const audio = readCache(text) || await primeLine(text);
  if (!audio) return;   // nothing to play; caller carries on regardless
  await play(audio);
}

// Cutting her off also SETTLES the pending promise. Without that, a learner who
// skipped the line would wait out the whole ceiling before the microphone
// opened — the skip button would look broken.
export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
  if (endCurrent) { const settle = endCurrent; endCurrent = null; settle(); }
}

export default speakLine;

import pronunciations from '../data/pronunciations.json';

// Hearing a word: every topic word and idiom has a recorded pronunciation
// (Gemini TTS, one voice for the whole app — scripts/pronounce-tts.cjs) in
// Storage `pronounce/<slug>.mp3`. All of them carry the same download token, so
// the URL comes from the word itself and pronunciations.json is only the list
// of slugs that exist. Anything else (a word from a call report, a sentence)
// falls back to the browser's own voice — free, but robotic or missing on some
// Android phones, which is why the vocabulary got real recordings.
const BUCKET = 'speak2them-64f2b.firebasestorage.app';
const PRONOUNCE_TOKEN = '772f89e8-ff7a-44f4-bebf-dddc519e6808'; // = TOKEN in scripts/pronounce-tts.cjs
const RECORDED = new Set(pronunciations.slugs || []);

// Must stay identical to slugOf in scripts/pronounce-tts.cjs.
export const pronounceSlug = (text) => String(text || '').toLowerCase()
  .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function recordedUrl(text) {
  const slug = pronounceSlug(text);
  if (!slug || !RECORDED.has(slug)) return null;
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`pronounce/${slug}.mp3`)}?alt=media&token=${PRONOUNCE_TOKEN}`;
}

const canSynth = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export const canPronounce = (text) => !!recordedUrl(text) || canSynth();

let clip = null;

function synth(text, slow) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = slow ? 0.65 : 0.9;
    window.speechSynthesis.speak(u);
  } catch { /* no voice on this device */ }
}

// One sound at a time: a new tap stops the previous word.
export function pronounce(text, { slow = false } = {}) {
  if (!text) return;
  try { clip?.pause(); } catch { /* already gone */ }
  if (canSynth()) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
  const url = recordedUrl(text);
  if (!url) { if (canSynth()) synth(text, slow); return; }
  try {
    clip = new Audio(url);
    clip.playbackRate = slow ? 0.75 : 1;
    // Offline or blocked: the browser voice is better than silence.
    clip.play().catch(() => { if (canSynth()) synth(text, slow); });
  } catch {
    if (canSynth()) synth(text, slow);
  }
}

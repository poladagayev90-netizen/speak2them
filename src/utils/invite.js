// "Practise with me" links (2026-10-01).
//
// Two learners agree a time on WhatsApp but have never talked in the app, so
// neither is in the other's Partners list and — with random search gone —
// they could not reach each other. A personal link fixes that: it opens a
// chat with the person who sent it. Nothing new is exposed (a uid is already
// on the world-readable users doc), and a call from that chat still goes
// through pairVerdict on the server (block / avoid / minor-with-adult).
//
// Same shape as the teacher invite (utils/teacher.js): the link survives the
// trip through register/login in localStorage and is picked up afterwards.

const PROD_ORIGIN = 'https://speaklab-app.vercel.app';
const PENDING_KEY = 'speaklab_pending_practice_peer';
const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;

// The link must always point at the web app: on Android the WebView origin is
// localhost, which means nothing on the other person's phone.
export function buildPracticeLink(uid, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const base = /^https:\/\//.test(origin || '') && !/localhost|capacitor/.test(origin) ? origin : PROD_ORIGIN;
  return `${base}/p/${encodeURIComponent(uid)}`;
}

// "/p/<uid>" → uid, or '' for anything else (including a malformed uid).
export function readPeerFromPath(pathname) {
  const m = /^\/p\/([^/?#]+)\/?$/.exec(pathname || '');
  if (!m) return '';
  let uid = '';
  try { uid = decodeURIComponent(m[1]); } catch { return ''; }
  return UID_RE.test(uid) ? uid : '';
}

export function setPendingPeer(uid) {
  try { localStorage.setItem(PENDING_KEY, uid); } catch { /* private mode */ }
}
export function getPendingPeer() {
  try { return localStorage.getItem(PENDING_KEY) || ''; } catch { return ''; }
}
export function clearPendingPeer() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
}

export function inviteMessage(name, link) {
  const who = name ? `${name} here — ` : '';
  return `${who}let's practise English on SpeakLab. Tap to open my chat, then call me when we're both ready: ${link}`;
}

// Presence is written from two places: the App-level heartbeat/visibility
// handlers and the call screen. Without a shared flag the heartbeat would
// overwrite users/{uid}.status back to "online" while a call is running
// (e.g. every time the user tabs away and back), so peers would see a busy
// user as available. Chat.jsx owns this flag; App.js only reads it.
let inCall = false;

export const setInCallFlag = (value) => { inCall = !!value; };
export const isInCall = () => inCall;

// A "busy" status left behind by a crashed tab would be sticky forever, so it
// only counts while the heartbeat is still fresh (same 300s window Home uses).
export const ONLINE_WINDOW_MS = 300000;

export function getPresence(userDoc, now = Date.now()) {
  const lastSeen = userDoc?.lastSeen?.toMillis?.() || 0;
  if (now - lastSeen >= ONLINE_WINDOW_MS) return 'offline';
  return userDoc.status === 'busy' ? 'busy' : 'online';
}

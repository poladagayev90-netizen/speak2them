// Presence is written from two places: the App-level heartbeat/visibility
// handlers and the call screen. Without a shared flag the heartbeat would
// overwrite users/{uid}.status back to "online" while a call is running
// (e.g. every time the user tabs away and back), so peers would see a busy
// user as available. Chat.jsx owns this flag; App.js only reads it.
let inCall = false;

export const setInCallFlag = (value) => { inCall = !!value; };
export const isInCall = () => inCall;

// A "busy" status left behind by a crashed tab would be sticky forever, so it
// only counts while the heartbeat is still fresh. 150s = 2.5× the 60s App.js
// heartbeat; shrink both together or active users flicker offline.
export const ONLINE_WINDOW_MS = 150000;

export function getPresence(userDoc, now = Date.now()) {
  // An explicit offline status wins over a fresh lastSeen: goOffline() stamps
  // lastSeen at the moment of exit, so checking the window first made a user
  // who just LEFT look online for the whole window.
  if (userDoc?.status === 'offline') return 'offline';
  const lastSeen = userDoc?.lastSeen?.toMillis?.() || 0;
  if (now - lastSeen >= ONLINE_WINDOW_MS) return 'offline';
  return userDoc.status === 'busy' ? 'busy' : 'online';
}

// "Seen 5 min ago" / "2 h ago" / "yesterday" / "6 days ago" — the admin's and
// a teacher's view of someone who is not online right now.
export function lastSeenLabel(ms, now = Date.now()) {
  if (!ms) return 'never seen';
  const min = Math.max(0, Math.floor((now - ms) / 60000));
  if (min < 3) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

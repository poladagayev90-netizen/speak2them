import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Session times are editable from Firestore without a code change. A config
// with no `sessions` array falls back to the two standard daily sessions.
export const DEFAULT_SESSION_CONFIG = {
  enabled: false,
  bufferMinutes: 10,
  sessions: [
    { hour: 16, minute: 0 },
    { hour: 21, minute: 0 },
  ],
};

export function subscribeToSessionConfig(cb) {
  return onSnapshot(
    doc(db, 'appConfig', 'session'),
    (snap) => cb(snap.exists() ? { ...DEFAULT_SESSION_CONFIG, ...snap.data() } : DEFAULT_SESSION_CONFIG),
    () => cb(DEFAULT_SESSION_CONFIG)
  );
}

// Normalises a config into a sorted list of {hour, minute}. A non-empty
// `sessions` array wins; otherwise the two standard sessions are used. Legacy
// single-time configs (bare hour/minute, no sessions) are intentionally
// upgraded to the two-session default rather than preserved.
export function getSessionTimes(config) {
  const list = Array.isArray(config?.sessions) && config.sessions.length
    ? config.sessions
    : DEFAULT_SESSION_CONFIG.sessions;
  return [...list]
    .filter((s) => Number.isFinite(s?.hour))
    .map((s) => ({ hour: s.hour, minute: s.minute || 0 }))
    .sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
}

const pad = (n) => String(n).padStart(2, '0');

// The learner keeps seeing a just-finished session (its "matching…" state) for
// this long before the card rolls forward to the next one.
const ROLL_GRACE_MS = 5 * 60 * 1000;

function bakuDateStr(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(new Date(ms));
}

function buildWindow(dateStr, time, bufferMs) {
  const startMs = Date.parse(`${dateStr}T${pad(time.hour)}:${pad(time.minute)}:00+04:00`);
  return {
    sessionId: `${dateStr}-${pad(time.hour)}`,
    hour: time.hour,
    minute: time.minute,
    startMs,
    endMs: startMs + bufferMs,
  };
}

// Session times are defined in Baku time (UTC+4, no DST) so every client
// computes the exact same window and sessionId regardless of device timezone.
// Returns the next relevant session: the earliest of today's sessions that has
// not yet finished (including a short grace window), else tomorrow's first.
export function getSessionWindow(config, nowMs = Date.now()) {
  const bufferMs = (Number.isFinite(config?.bufferMinutes) ? config.bufferMinutes : 10) * 60 * 1000;
  const times = getSessionTimes(config);
  const today = bakuDateStr(nowMs);

  for (const time of times) {
    const win = buildWindow(today, time, bufferMs);
    if (nowMs < win.endMs + ROLL_GRACE_MS) return win;
  }

  const tomorrow = bakuDateStr(nowMs + 24 * 60 * 60 * 1000);
  return buildWindow(tomorrow, times[0], bufferMs);
}

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Session time is editable from Firestore without a code change.
export const DEFAULT_SESSION_CONFIG = {
  enabled: false,
  hour: 21,
  minute: 0,
  bufferMinutes: 10,
};

export function subscribeToSessionConfig(cb) {
  return onSnapshot(
    doc(db, 'appConfig', 'session'),
    (snap) => cb(snap.exists() ? { ...DEFAULT_SESSION_CONFIG, ...snap.data() } : DEFAULT_SESSION_CONFIG),
    () => cb(DEFAULT_SESSION_CONFIG)
  );
}

// Session times are defined in Baku time (UTC+4, no DST) so every client
// computes the exact same window and sessionId regardless of device timezone.
export function getSessionWindow(config, nowMs = Date.now()) {
  const bakuDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' })
    .format(new Date(nowMs));
  const hh = String(config.hour).padStart(2, '0');
  const mm = String(config.minute).padStart(2, '0');
  const startMs = Date.parse(`${bakuDate}T${hh}:${mm}:00+04:00`);
  return {
    sessionId: bakuDate,
    startMs,
    endMs: startMs + config.bufferMinutes * 60 * 1000,
  };
}

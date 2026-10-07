import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Which hours a person had the app open, day by day (2026-10-07).
//
// users.lastSeen says only "when last": the admin asked to see clearly WHO was
// in the app and WHEN, and teachers the same for their own students. One doc
// per person per Baku day — presenceDays/{uid}_{YYYY-MM-DD} = {uid, date,
// hours: [20, 21], lastAt} — written by the App heartbeat only when the Baku
// HOUR changes, so a whole evening in the app costs a few writes, not one a
// minute. Read by the admin and the person's teacher (firestore.rules).
//
// It is a record of app use, nothing more: it grants nothing, so the owner
// writing it is fine — the rules keep it to these fields and the server clock.

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000; // Baku has no DST

export function bakuDayHour(ms = Date.now()) {
  const d = new Date(ms + BAKU_OFFSET_MS);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

export const presenceDocId = (uid, date) => `${uid}_${date}`;

let lastLogged = '';

// Called on load, on every heartbeat and when the app comes back to the
// screen; only the first call in a new hour writes.
export async function logPresence(uid, nowMs = Date.now()) {
  if (!uid) return;
  const { date, hour } = bakuDayHour(nowMs);
  const key = `${uid}_${date}_${hour}`;
  if (key === lastLogged) return;
  lastLogged = key;
  try {
    await setDoc(doc(db, 'presenceDays', presenceDocId(uid, date)), {
      uid, date, hours: arrayUnion(hour), lastAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    lastLogged = ''; // try again on the next heartbeat
  }
}

// The last `days` Baku dates, newest first.
export function lastDates(days, nowMs = Date.now()) {
  const out = [];
  for (let i = 0; i < days; i += 1) out.push(bakuDayHour(nowMs - i * 24 * 60 * 60 * 1000).date);
  return out;
}

// One person's days, by id (a teacher may only GET them — a list query cannot
// be proved against the per-student teacher check in the rules).
export async function fetchPresenceDays(uid, days = 14, nowMs = Date.now()) {
  const dates = lastDates(days, nowMs);
  const snaps = await Promise.all(dates.map((d) => getDoc(doc(db, 'presenceDays', presenceDocId(uid, d))).catch(() => null)));
  return dates.map((date, i) => {
    const s = snaps[i];
    return { date, hours: s && s.exists() ? [...(s.data().hours || [])].sort((a, b) => a - b) : [] };
  });
}

// "09–10, 20–23" — a day's hours as short runs (each hour is start–end).
export function hoursLabel(hours) {
  const h = [...new Set(hours || [])].sort((a, b) => a - b);
  const runs = [];
  for (const x of h) {
    const last = runs[runs.length - 1];
    if (last && x === last[1] + 1) last[1] = x;
    else runs.push([x, x]);
  }
  const pad = (n) => String(n).padStart(2, '0');
  return runs.map(([a, b]) => `${pad(a)}–${pad((b + 1) % 24)}`).join(', ');
}

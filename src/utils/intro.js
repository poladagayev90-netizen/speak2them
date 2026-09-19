import {
  collection, query, where, orderBy, limit, onSnapshot, doc, addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE, ADMIN_UID } from '../constants';

// Intro call with the SpeakLab team — client side (see bookIntro in functions).
//
// Required, not blocking: until users.introDoneAt is set (only the admin can
// set it), random search and the slot board are locked. Everything else —
// AInur, topics, daily content — is open from day one.

// Who still has to meet the team. Everyone ALREADY practising is exempt, so
// switching this on does not lock out the learners who have been using the
// app: anyone with a call behind them, anyone with a teacher (the teacher
// already knows them), anyone the admin accepted into a course.
export function needsIntro(user) {
  if (!user || user.role === 'teacher' || user.uid === ADMIN_UID) return false;
  if (user.introDoneAt) return false;
  if (user.teacherId) return false;
  if (['accepted', 'active'].includes(user.cohortStatus)) return false;
  if ((Number(user.callCount) || 0) > 0) return false;
  return true;
}

const ERROR_TEXT = {
  'slot-taken': 'Someone just booked this time. Please pick another.',
  'slot-too-soon': 'This time starts too soon to book. Please pick a later one.',
  'slot-not-found': 'This time is no longer available.',
  'intro-done': 'You have already met the team.',
  'no-booking': 'There is no booking to change.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

async function call(path, body) {
  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/${path}`, { method: 'POST', body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error,
        errorText: res.status === 429 ? 'Too many attempts. Please try again later.'
          : (ERROR_TEXT[data.error] || 'Something went wrong. Please try again.'),
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(`[${path}]`, e);
    return { ok: false, errorText: 'Network error. Check your connection and try again.' };
  }
}

// ── learner ──────────────────────────────────────────────────────
// Future team times, soonest first. Booked ones are filtered out by the
// caller so a time taken while the list is open disappears live.
export function subscribeToTeamSlots(cb, { includeBooked = false } = {}) {
  const q = query(collection(db, 'teamSlots'), where('startMs', '>', Date.now()), orderBy('startMs'), limit(80));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => includeBooked || !s.booked)),
    (err) => { console.warn('[intro] slots failed', err.code); cb([]); },
  );
}

export function subscribeToMyIntro(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, 'introBookings', uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null),
  );
}

export const bookIntro = (slotId) => call('bookIntro', { slotId });
export const cancelIntro = () => call('cancelIntro');

// ── admin ────────────────────────────────────────────────────────
export function subscribeToAllTeamSlots(cb, sinceMs) {
  const q = query(collection(db, 'teamSlots'), where('startMs', '>', sinceMs), orderBy('startMs'), limit(200));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

export function subscribeToIntroBookings(cb) {
  return onSnapshot(
    collection(db, 'introBookings'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

export function createTeamSlot({ startMs, durationMin, meetUrl, hostName }) {
  return addDoc(collection(db, 'teamSlots'), {
    startMs, durationMin, meetUrl: meetUrl || '', hostName: hostName || '',
    booked: false, createdAt: serverTimestamp(),
  });
}

export const deleteTeamSlot = (id) => deleteDoc(doc(db, 'teamSlots', id));
export const markIntro = (uid, outcome, note) => call('adminMarkIntro', { uid, outcome, note });

// "Tomorrow · 19:00–19:15" in the viewer's own clock.
export function introTimeLabel(startMs, durationMin = 15) {
  const s = new Date(startMs);
  const e = new Date(startMs + durationMin * 60000);
  const t = { hour: '2-digit', minute: '2-digit', hour12: false };
  const today = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  const day = same(s, today) ? 'Today'
    : same(s, new Date(today.getTime() + 86400000)) ? 'Tomorrow'
      : s.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  return { day, time: `${s.toLocaleTimeString([], t)}–${e.toLocaleTimeString([], t)}` };
}

export const localDayKey = (ms) => new Date(ms).toDateString();

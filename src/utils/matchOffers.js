import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

// Admin pair proposals — client side.
//
// An offer is NOT a booking. It becomes one only when both people confirm
// (respondMatchOffer books it through the same path as any other pair, so it
// then shows up as the ordinary upcomingCall card). Until then each learner
// sees a proposal card; who declined and why is admin-only
// (matchOfferNotes), so nobody is ever told "they said no to you".

export const DECLINE_REASONS = [
  { value: 'not-free', label: 'I am not free then' },
  { value: 'other-partner', label: 'I would prefer another partner' },
  { value: 'other', label: 'Something else' },
];

const ERROR_TEXT = {
  'offer-closed': 'This proposal has already closed.',
  'offer-failed': 'One of you was booked for another call in the meantime, so this time could not be booked. The team will suggest a new one.',
  'offer-not-found': 'This proposal no longer exists.',
  'not-your-offer': 'This proposal is not addressed to you.',
  'slot-past': 'That time has already started.',
  'slot-too-far': 'Proposals can be made up to five days ahead.',
  'user-not-found': 'One of these learners no longer has an account.',
  // Admin-only reasons (the admin sees them; learners never do).
  'pair-blocked': 'One of them has blocked the other.',
  'pair-avoided': 'One of them asked not to be paired with the other again.',
  'pair-age': 'A learner under 18 cannot be paired with an adult.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

async function call(path, body) {
  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/${path}`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error,
        errorText: res.status === 429
          ? 'Too many attempts. Please try again later.'
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
export function subscribeToMyOffers(uid, cb) {
  if (!uid) return () => {};
  const q = query(
    collection(db, 'matchOffers'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'pending'),
    limit(5),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn('[matchOffers] subscribe failed', err.code); cb([]); },
  );
}

export function respondToOffer(offerId, accept, reason) {
  return call('respondMatchOffer', { offerId, accept, reason });
}

// ── admin ────────────────────────────────────────────────────────
export function proposeMatch({ userA, userB, slotId, note }) {
  return call('adminProposeMatch', { userA, userB, slotId, note });
}

export function cancelOffer(offerId) {
  return call('adminCancelOffer', { offerId });
}

export function subscribeToRecentOffers(cb) {
  const q = query(collection(db, 'matchOffers'), orderBy('createdAt', 'desc'), limit(40));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn('[matchOffers] admin subscribe failed', err.code); cb([]); },
  );
}

export function subscribeToOfferNotes(cb) {
  return onSnapshot(
    collection(db, 'matchOfferNotes'),
    (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),
    () => cb({}),
  );
}

// "Today 21:00–23:00" / "Tomorrow …" / "Wed 21:00–23:00" in the VIEWER's own
// clock. Blocks are defined in Baku time, but a learner in Istanbul must read
// the hour on their own phone.
export function localBlockLabel(startMs, durationMs = 2 * 60 * 60 * 1000) {
  const start = new Date(startMs);
  const end = new Date(startMs + durationMs);
  const t = { hour: '2-digit', minute: '2-digit', hour12: false };
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const same = (a, b) => a.toDateString() === b.toDateString();
  const day = same(start, today) ? 'Today'
    : same(start, tomorrow) ? 'Tomorrow'
      : start.toLocaleDateString('en-GB', { weekday: 'long' });
  return { day, time: `${start.toLocaleTimeString([], t)}–${end.toLocaleTimeString([], t)}` };
}

export const offerErrorText = (code, fallback) => ERROR_TEXT[code] || fallback;

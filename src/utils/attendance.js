import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Attendance ledger — client side. Written only by the server (see
// attendanceDoc in functions/practiceStats.js).
//
// The one rule that shapes everything here: partner_no_show and unmatched are
// the PLATFORM failing the learner. They are shown to the admin, separately,
// and never count against the learner.

export const OUTCOMES = {
  attended: { label: 'Attended', mine: true, good: true },
  no_show: { label: 'No-show', mine: true, good: false },
  late_cancel: { label: 'Late cancel', mine: true, good: false },
  cancelled: { label: 'Cancelled in time', mine: true, good: null },
  partner_no_show: { label: 'Partner did not come', mine: false, good: null },
  unmatched: { label: 'No partner found', mine: false, good: null },
};

// Monday of the Baku week, "YYYY-MM-DD" — the same key the server writes
// (weekKey in functions/practiceStats.js).
export function weekKeyOf(ms = Date.now()) {
  const d = new Date(ms + 4 * 3600000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const bakuDay = (ms) => new Date(Number(ms) + 4 * 3600000).toISOString().slice(0, 10);

export function subscribeToMyWeek(uid, cb, wk = weekKeyOf()) {
  if (!uid) return () => {};
  const q = query(collection(db, 'attendance'), where('uid', '==', uid), where('weekKey', '==', wk), limit(50));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())), () => cb([]));
}

export function subscribeToRecentAttendance(cb, sinceMs) {
  const q = query(collection(db, 'attendance'), where('atMs', '>=', sinceMs), orderBy('atMs', 'desc'), limit(2000));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
}

// Per-learner summary over the last four weeks, from the raw events.
export function summarize(events, now = Date.now()) {
  const weeks = [0, 1, 2, 3].map((i) => weekKeyOf(now - i * 7 * 86400000)); // this week first
  const s = {
    attendedByWeek: Object.fromEntries(weeks.map((w) => [w, 0])),
    noShow: 0, lateCancel: 0, cancelled: 0, platformMissed: 0, lastAttendedMs: 0,
  };
  const unmatchedDays = new Set();
  for (const e of events) {
    if (!weeks.includes(e.weekKey)) continue;
    if (e.outcome === 'attended') {
      s.attendedByWeek[e.weekKey] += 1;
      s.lastAttendedMs = Math.max(s.lastAttendedMs, Number(e.atMs) || 0);
    } else if (e.outcome === 'no_show') s.noShow += 1;
    else if (e.outcome === 'late_cancel') s.lateCancel += 1;
    else if (e.outcome === 'cancelled') s.cancelled += 1;
    else if (e.outcome === 'partner_no_show') s.platformMissed += 1;
    // One learner can wait in several blocks a day; a day with no partner is
    // one miss, not four.
    else if (e.outcome === 'unmatched') unmatchedDays.add(bakuDay(e.atMs));
  }
  s.platformMissed += unmatchedDays.size;
  s.weeks = weeks;
  s.thisWeek = s.attendedByWeek[weeks[0]];
  return s;
}

// «What happened?» after a missed practice, a late or in-time cancel, or a
// time change (Faza 3, 2026-10-07). The answer goes to missReasons/
// {eventId}_{uid} — the learner writes it once, only the team reads it — and
// «the time was wrong for me» makes the weekly planner try another hour first.
//
// Pure: the listeners live in hooks/useMissPrompt.js.

export const MISS_REASONS = [
  { value: 'wrong_time', label: 'The time was wrong for me' },
  { value: 'came_up', label: 'Something came up' },
  { value: 'forgot', label: 'I forgot' },
  { value: 'other', label: 'Other' },
];
export const REASON_LABEL = Object.fromEntries(MISS_REASONS.map((r) => [r.value, r.label]));

// Attendance outcomes that are the learner's own (partner_no_show and
// unmatched are the platform's, and nobody is asked about those).
export const MISS_KINDS = ['no_show', 'late_cancel', 'cancelled'];
export const NOTE_MAX = 200;
const ASK_WITHIN_MS = 14 * 24 * 60 * 60 * 1000;

// «I forgot» only answers a missed practice; you do not forget to cancel.
export const reasonsFor = (kind) => MISS_REASONS.filter((r) => kind === 'no_show' || r.value !== 'forgot');

export const questionFor = (kind) => ({
  no_show: 'You missed a practice',
  late_cancel: 'You cancelled a practice',
  cancelled: 'You cancelled a practice',
  time_change: 'You asked to change the time',
}[kind] || 'What happened?');

// The one event to ask about now: the newest of the last two weeks that has
// no answer and was not put aside on this device. A cancel carries the
// practice's start (atMs), which may still be days ahead — asked at once.
export function pendingMiss({ events = [], answered = new Set(), dismissed = new Set(), now = Date.now() }) {
  return events
    .filter((e) => e && e.id && MISS_KINDS.includes(e.outcome) && e.slotId)
    .filter((e) => now - Number(e.atMs) <= ASK_WITHIN_MS)
    .filter((e) => !answered.has(e.id) && !dismissed.has(e.id))
    .sort((a, b) => Number(b.atMs) - Number(a.atMs))[0] || null;
}

// The doc the rules accept (firestore.rules missReasons): `at` is added by the
// caller as serverTimestamp().
export function missReasonDoc({ uid, eventId, kind, reason, note, slotId }) {
  const doc = { uid, eventId, kind, reason, slotId };
  const n = String(note || '').trim().slice(0, NOTE_MAX);
  if (n) doc.note = n;
  return doc;
}

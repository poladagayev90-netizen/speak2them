// Reminder ladder for a booked practice call: 24 h, 1 h and 10 min before,
// to both people (2026-11-10 — learners, the founder included, kept forgetting
// booked calls; until then the only reminder was one push 10 min before).
//
// Pure helpers only; the minute tick (practiceSlotTick) does the I/O.
//
// Idempotency: each step that went out is stamped on the booking itself
// (`reminded.<step>`), claimed in a transaction before the push is sent. The
// booking id is per slot + pair, so:
//   - a cancelled booking is no longer "confirmed" → nothing more is sent;
//   - a reschedule writes a NEW booking (new slot id, fresh `reminded`) and
//     marks the old one "moved" → the old ladder stops, the new one starts;
//   - re-booking a block the pair had cancelled rewrites the doc without
//     merge (bookings.writeBookingTx), so its flags start empty again.

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Each step is due while the time left is in (until, at]. A tick that fails
// is caught up by the next one inside the window; past the window the step is
// skipped rather than sent with copy that no longer fits.
const STEPS = [
  { key: "24h", at: 24 * HOUR, until: 2 * HOUR },
  { key: "1h", at: HOUR, until: 15 * MIN },
  { key: "10m", at: 10 * MIN, until: 0 },
];

// The tick reads the near window every minute and the far one every 15 min
// (the 24 h step does not need minute precision; this keeps reads low).
const NEAR_WINDOW_MS = HOUR;
const FAR_WINDOW_MS = 24 * HOUR;

function createdMsOf(b) {
  const c = b && b.createdAt;
  if (!c) return 0;
  if (typeof c.toMillis === "function") return c.toMillis();
  if (typeof c === "number") return c;
  return 0;
}

// The one step to send for this booking now, or null.
//
// A step whose moment had already passed when the call was booked is skipped:
// a booking made 50 min ahead gets no «in an hour» push a minute later — the
// booking confirmation has just told them. It still gets the 10-min one.
function dueReminderStep(booking, nowMs) {
  const b = booking || {};
  if (b.status !== "confirmed") return null;
  const startMs = Number(b.startMs);
  if (!Number.isFinite(startMs)) return null;
  const left = startMs - nowMs;
  if (left <= 0) return null;
  const created = createdMsOf(b);
  const sent = b.reminded || {};
  for (const s of STEPS) {
    if (left > s.at || left <= s.until) continue;
    if (sent[s.key]) return null;
    if (created && created > startMs - s.at) return null;
    return s.key;
  }
  return null;
}

// How long FCM should hold an undelivered reminder: never past the call start
// (a "10 minutes" push arriving after the call is noise). Seconds, ≥ 60.
function reminderTtlSeconds(startMs, nowMs) {
  return Math.max(60, Math.floor((Number(startMs) - nowMs) / 1000));
}

// "Aysel Mammadova" → "Aysel". Empty when there is no name.
function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

// One tag per booking: the 1 h push replaces the 24 h one in the tray (and
// re-alerts), but two different calls never replace each other.
const reminderTag = (bookingId) => `call_${bookingId}`;

module.exports = {
  STEPS, NEAR_WINDOW_MS, FAR_WINDOW_MS,
  dueReminderStep, reminderTtlSeconds, firstName, reminderTag,
};

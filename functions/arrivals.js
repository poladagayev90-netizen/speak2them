// ── Arrival and lateness per booked practice ───────────────────────
// Who came to a booked call, and how many minutes after the start.
//
// Sources, most trusted first:
//   "server"   bookingArrivals/{bookingId}.{uid} — the FIRST voice token
//              getAgoraToken handed this person for this booking, stamped with
//              the server clock (serverTimestamp). Server-only collection.
//   "client"   practiceSlots/{slot}/members/{uid}.arrivedAt — written by the
//              app on every join (Chat.jsx). The rules do not pin it to
//              request.time and every rejoin overwrites it, so it is the LAST
//              join as the app reported it: a fallback only, for app builds
//              or bookings from before the server record existed.
//   "backfill" scripts/backfill-arrivals.cjs: the earliest of the client
//              arrivedAt and the pair's last agoraJoins token inside the
//              block — both are "last join", so a rejoin can make a person
//              look later than they were.
//
// Stored on the closed booking as `arrival.{uid}` = { atMs, lateMin, source },
// or null for "did not come". Lateness is never a penalty on its own: it is
// shown to the admin (Admin → Students → Attendance) for a conversation, and
// a partner who did not come is still never the comer's fault.

// A voice token this long before the start already counts as "here" — the
// call doc is ready 30 min ahead (bookings.js CALL_PREP_LEAD_MS).
const ARRIVAL_EARLY_MS = 30 * 60 * 1000;
// Up to this many minutes after the start is "on time" (opening the app,
// the mic prompt, a slow network).
const ON_TIME_GRACE_MIN = 2;

const msOf = (t) => {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t === 'number') return t;
  if (typeof t._seconds === 'number') return t._seconds * 1000;
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  const parsed = Date.parse(t);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Whole minutes after the start; arriving early is 0.
function lateMinutes(arrivedMs, startMs) {
  if (!arrivedMs || !startMs) return null;
  return Math.max(0, Math.floor((arrivedMs - startMs) / 60000));
}

// Does an arrival at `atMs` belong to the booking [startMs, endMs)?
function inArrivalWindow(atMs, startMs, endMs) {
  return !!atMs && atMs >= startMs - ARRIVAL_EARLY_MS && atMs < endMs;
}

// One side of a closed booking. `serverAt` / `clientAt` are timestamps or
// millis; anything outside the block's window is ignored (a token from a
// direct call the day before is not an arrival).
function arrivalFor({ serverAt, clientAt, startMs, endMs, source }) {
  const s = msOf(serverAt);
  if (inArrivalWindow(s, startMs, endMs)) return { atMs: s, lateMin: lateMinutes(s, startMs), source: source || 'server' };
  const c = msOf(clientAt);
  if (inArrivalWindow(c, startMs, endMs)) return { atMs: c, lateMin: lateMinutes(c, startMs), source: source || 'client' };
  return null;
}

// The bookings a voice token at `nowMs` may be an arrival for: every block
// whose arrival window holds now. Blocks start every hour and last two, so
// up to three candidates; a pair has at most one of them booked.
function candidateSlotIds(nowMs, { dates, hours, parseSlotId }) {
  const out = [];
  for (const date of dates) {
    for (const h of hours) {
      const slot = parseSlotId(`${date}-${String(h).padStart(2, '0')}`);
      if (slot && inArrivalWindow(nowMs, slot.startMs, slot.endMs)) out.push(slot.slotId);
    }
  }
  return out;
}

// The closed booking's `arrival` map. null = did not come (outcome no_show).
// A side who came but has no usable time (a held call from a very old app,
// an arrivedAt outside the block) is left out: "came, time unknown", never
// called absent.
function bookingArrivalMap(uids, arrival, outcomes) {
  const out = {};
  for (const uid of uids) {
    if (!uid) continue;
    if (arrival[uid]) out[uid] = arrival[uid];
    else if (outcomes[uid] === 'no_show') out[uid] = null;
  }
  return out;
}

module.exports = {
  ARRIVAL_EARLY_MS, ON_TIME_GRACE_MIN,
  lateMinutes, inArrivalWindow, arrivalFor, candidateSlotIds, bookingArrivalMap, msOf,
};

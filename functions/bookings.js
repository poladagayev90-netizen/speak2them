const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const { weekKey } = require('./practiceStats');

// ── Bookings: one record per booked pair per block ─────────────────
// bookings/{slotId}_{lo}_{hi}, server-written only. It exists because
// users.upcomingCall is ONE field: a learner could hold one booked call at a
// time, so a week of three practices could not even be set up by hand. The
// practiceSlots member docs stay exactly as they were (the minute tick,
// `arrivedAt` and older app builds all read them); a booking is written in the
// same transaction as the member docs, never on its own.
//
// users.upcomingCall is now DERIVED: the nearest confirmed booking, rewritten
// by the syncUpcomingCall trigger whenever a booking changes. Older app builds
// keep reading it and simply always see the NEXT call.

const BLOCK_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// A booked pair's calls/{id} doc is written this close to the start, not at
// booking time. Written days ahead it made old app builds walk into an empty
// call room when the chat was opened, made the pair look "recently met" to
// pairVerdict, and a second booking of the same pair overwrote the first.
const CALL_PREP_LEAD_MS = 30 * 60 * 1000;
// The minute tick prepares the doc from this point before the start.
const CALL_PREP_TICK_MS = 15 * 60 * 1000;

const sortedPair = (a, b) => [a, b].sort();
const bookingIdFor = (slotId, a, b) => `${slotId}_${sortedPair(a, b).join('_')}`;
const callIdForPair = (a, b) => `call_${sortedPair(a, b).join('_')}`;
// Baku has no DST: midnight is always 00:00+04:00.
const bakuDayStartMs = (date) => Date.parse(`${date}T00:00:00+04:00`);

function bookingDoc({ slot, uidA, uidB, nameA, nameB, levelA, levelB, source, marker = {}, nowMs = Date.now() }) {
  return {
    slotId: slot.slotId,
    date: slot.date,
    startMs: slot.startMs,
    endMs: slot.endMs,
    weekKey: weekKey(slot.startMs),
    participants: sortedPair(uidA, uidB),
    names: { [uidA]: nameA || '', [uidB]: nameB || '' },
    levels: { [uidA]: levelA || null, [uidB]: levelB || null },
    status: 'confirmed',
    source: source || 'slot_match',
    marker,
    callId: callIdForPair(uidA, uidB),
    createdAt: Timestamp.fromMillis(nowMs),
    updatedAt: Timestamp.fromMillis(nowMs),
  };
}

// No merge: a pair re-booked into a block they had cancelled gets a clean record.
function writeBookingTx(tx, db, args) {
  const id = bookingIdFor(args.slot.slotId, args.uidA, args.uidB);
  tx.set(db.doc(`bookings/${id}`), bookingDoc(args));
  return id;
}

// status: cancelled | done | moved. The identifying fields are written too, so
// a pair booked before bookings existed still leaves a complete closed record.
function closeBookingTx(tx, db, { slot, uidA, uidB, status, extra = {}, nowMs = Date.now() }) {
  const id = bookingIdFor(slot.slotId, uidA, uidB);
  tx.set(db.doc(`bookings/${id}`), {
    slotId: slot.slotId, date: slot.date, startMs: slot.startMs, endMs: slot.endMs,
    weekKey: weekKey(slot.startMs),
    participants: sortedPair(uidA, uidB),
    status,
    updatedAt: Timestamp.fromMillis(nowMs),
    ...extra,
  }, { merge: true });
  return id;
}

// What users.upcomingCall looks like for one side of a booking — the same
// shape older app builds already read (slotId, startMs, peerUid, peerName,
// callId, plus who set it up).
function upcomingFor(booking, uid) {
  const peerUid = (booking.participants || []).find((p) => p !== uid) || null;
  return {
    slotId: booking.slotId,
    startMs: booking.startMs,
    peerUid,
    peerName: (booking.names || {})[peerUid] || '',
    callId: booking.callId || (peerUid ? callIdForPair(uid, peerUid) : null),
    bookingId: booking.id,
    ...(booking.marker || {}),
  };
}

// The nearest booking that is still on (its block has not ended).
function pickUpcoming(bookings, uid, nowMs) {
  let best = null;
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    if (!(b.participants || []).includes(uid)) continue;
    if (!(b.endMs > nowMs)) continue;
    if (!best || b.startMs < best.startMs) best = b;
  }
  return best;
}

const sameUpcoming = (x, y) => {
  if (!x || !y) return !x && !y;
  const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
  return keys.every((k) => x[k] === y[k]);
};

// In a transaction with a query read, so two booking changes landing at once
// cannot leave the older answer written last.
async function refreshUpcomingCall(db, uid, nowMs = Date.now()) {
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const [userSnap, snap] = await Promise.all([
      tx.get(userRef),
      tx.get(db.collection('bookings')
        .where('participants', 'array-contains', uid)
        .where('status', '==', 'confirmed')
        .where('startMs', '>', nowMs - BLOCK_MS)
        .orderBy('startMs')
        .limit(10)),
    ]);
    if (!userSnap.exists) return 'no-user';
    const next = pickUpcoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })), uid, nowMs);
    const want = next ? upcomingFor(next, uid) : null;
    if (sameUpcoming((userSnap.data() || {}).upcomingCall || null, want)) return 'unchanged';
    tx.set(userRef, { upcomingCall: want || FieldValue.delete() }, { merge: true });
    return want ? 'set' : 'cleared';
  });
}

// Confirmed bookings this person has on the same Baku day, in another block.
// At most one practice a day: a second one the same day is refused.
async function sameDayBookingsTx(tx, db, uid, slot) {
  const dayStart = bakuDayStartMs(slot.date);
  const snap = await tx.get(db.collection('bookings')
    .where('participants', 'array-contains', uid)
    .where('status', '==', 'confirmed')
    .where('startMs', '>=', dayStart)
    .where('startMs', '<', dayStart + DAY_MS)
    .limit(5));
  return snap.docs.filter((d) => d.get('slotId') !== slot.slotId);
}

const msOf = (v) => v?.toMillis?.() || 0;
// A call two people are in right now — never overwritten by a booking.
function callIsLive(call, nowMs) {
  if (!call) return false;
  if (call.status === 'calling') return nowMs - msOf(call.createdAt) < 2 * 60 * 1000;
  if (call.status !== 'accepted') return false;
  const connected = msOf(call.connectedAt);
  return !!connected && !call.endedAt && nowMs - connected < 60 * 60 * 1000;
}

// Decides what a booking does to the pair's calls/{id} doc. `callSnap` must
// have been read earlier in the same transaction (reads before writes).
//   • a live call is never touched;
//   • start within CALL_PREP_LEAD_MS: the doc is written now — NO merge, the
//     id is per pair and may still hold the previous call's length and flags;
//   • further away: nothing is written. A leftover `accepted` doc that is not
//     for a call about to start is closed, so opening the chat does not join it.
function planCallDocTx(tx, db, { callSnap, slot, callerUid, receiverUid, source, marker = {}, bookingId, nowMs, parseSlotId }) {
  const ref = db.doc(`calls/${callIdForPair(callerUid, receiverUid)}`);
  const d = callSnap && callSnap.exists ? (callSnap.data() || {}) : null;
  if (d && callIsLive(d, nowMs)) return 'live';
  if (slot.startMs - nowMs <= CALL_PREP_LEAD_MS) {
    const [lo, hi] = sortedPair(callerUid, receiverUid);
    tx.set(ref, {
      userA: lo, userB: hi,
      callerId: callerUid, receiverId: receiverUid,
      status: 'accepted', source,
      slotId: slot.slotId, bookingId,
      ...marker,
      createdAt: FieldValue.serverTimestamp(),
    });
    return 'written';
  }
  if (d && d.status === 'accepted') {
    const its = parseSlotId ? parseSlotId(d.slotId) : null;
    const imminent = its && its.endMs > nowMs && its.startMs - nowMs <= CALL_PREP_LEAD_MS;
    if (!imminent) {
      tx.set(ref, { status: 'cancelled' }, { merge: true });
      return 'closed-stale';
    }
  }
  return 'deferred';
}

module.exports = {
  BLOCK_MS, CALL_PREP_LEAD_MS, CALL_PREP_TICK_MS,
  bookingIdFor, bookingDoc, writeBookingTx, closeBookingTx,
  upcomingFor, pickUpcoming, sameUpcoming, refreshUpcomingCall,
  sameDayBookingsTx, callIsLive, planCallDocTx, bakuDayStartMs,
};

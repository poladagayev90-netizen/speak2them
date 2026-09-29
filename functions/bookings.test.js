const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('./bookings');

const H = 3600000;
const now = Date.parse('2026-10-05T10:00:00+04:00'); // a Monday, 10:00 Baku
const slotAt = (date, hour) => {
  const startMs = Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00+04:00`);
  return { slotId: `${date}-${String(hour).padStart(2, '0')}`, date, hour, startMs, endMs: startMs + 2 * H };
};
const parseSlotId = (id) => {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(String(id || ''));
  return m ? slotAt(m[1], Number(m[2])) : null;
};
const booking = (slot, over = {}) => ({ id: b.bookingIdFor(slot.slotId, 'amy', 'zed'), ...b.bookingDoc({ slot, uidA: 'amy', uidB: 'zed', nameA: 'Amy', nameB: 'Zed', source: 'admin_offer', marker: { setByAdmin: true }, nowMs: now }), ...over });

test('ids: booking per block per pair, sorted, same as the call id scheme', () => {
  assert.equal(b.bookingIdFor('2026-10-05-20', 'zed', 'amy'), '2026-10-05-20_amy_zed');
  assert.equal(booking(slotAt('2026-10-05', 20)).callId, 'call_amy_zed');
  assert.deepEqual(booking(slotAt('2026-10-05', 20)).participants, ['amy', 'zed']);
  assert.equal(b.bakuDayStartMs('2026-10-05'), Date.parse('2026-10-04T20:00:00Z'));
});

test('booking doc carries the week and both names', () => {
  const d = booking(slotAt('2026-10-07', 20));
  assert.equal(d.weekKey, '2026-10-05');
  assert.equal(d.status, 'confirmed');
  assert.deepEqual(d.names, { amy: 'Amy', zed: 'Zed' });
});

test('upcomingCall = the NEAREST confirmed booking whose block has not ended', () => {
  const mon = booking(slotAt('2026-10-05', 20));
  const wed = booking(slotAt('2026-10-07', 18));
  const past = booking(slotAt('2026-10-05', 8)); // ended at 10:00
  const cancelled = booking(slotAt('2026-10-05', 14), { status: 'cancelled' });
  assert.equal(b.pickUpcoming([wed, past, cancelled, mon], 'amy', now).slotId, mon.slotId);
  assert.equal(b.pickUpcoming([wed, past], 'amy', now).slotId, wed.slotId);
  assert.equal(b.pickUpcoming([past, cancelled], 'amy', now), null);
  assert.equal(b.pickUpcoming([mon], 'someone-else', now), null);
  // A block in progress still counts until it ends.
  const running = booking(slotAt('2026-10-05', 10));
  assert.equal(b.pickUpcoming([running, mon], 'amy', now + 30 * 60000).slotId, running.slotId);
});

test('upcomingCall keeps the shape older app builds read, per side', () => {
  const mon = booking(slotAt('2026-10-05', 20));
  const forAmy = b.upcomingFor(mon, 'amy');
  assert.deepEqual(
    { slotId: forAmy.slotId, peerUid: forAmy.peerUid, peerName: forAmy.peerName, callId: forAmy.callId, setByAdmin: forAmy.setByAdmin },
    { slotId: '2026-10-05-20', peerUid: 'zed', peerName: 'Zed', callId: 'call_amy_zed', setByAdmin: true },
  );
  assert.equal(b.upcomingFor(mon, 'zed').peerName, 'Amy');
  assert.equal(forAmy.startMs, slotAt('2026-10-05', 20).startMs);
  assert.ok(b.sameUpcoming(forAmy, { ...forAmy }));
  assert.ok(!b.sameUpcoming(forAmy, { ...forAmy, slotId: 'x' }));
  assert.ok(b.sameUpcoming(null, undefined));
});

test('a call in progress is live; a stale ring or an ended call is not', () => {
  const ts = (ms) => ({ toMillis: () => ms });
  assert.ok(b.callIsLive({ status: 'accepted', connectedAt: ts(now - 5 * 60000) }, now));
  assert.ok(!b.callIsLive({ status: 'accepted', connectedAt: ts(now - 5 * 60000), endedAt: ts(now) }, now));
  assert.ok(!b.callIsLive({ status: 'accepted' }, now)); // pre-written booking doc
  assert.ok(b.callIsLive({ status: 'calling', createdAt: ts(now - 20000) }, now));
  assert.ok(!b.callIsLive({ status: 'calling', createdAt: ts(now - 10 * 60000) }, now));
  assert.ok(!b.callIsLive({ status: 'ended', connectedAt: ts(now - 60000) }, now));
});

function fakeTx() {
  const writes = [];
  return { writes, tx: { set: (ref, data, opt) => writes.push({ path: ref.path, data, merge: !!opt?.merge }) } };
}
const db = { doc: (path) => ({ path }) };
const snap = (data) => ({ exists: !!data, data: () => data });

test('call doc: written (no merge) only when the start is within 30 minutes', () => {
  const soon = slotAt('2026-10-05', 10); // starts now
  const far = slotAt('2026-10-07', 20);
  let t = fakeTx();
  assert.equal(b.planCallDocTx(t.tx, db, { callSnap: snap(null), slot: soon, callerUid: 'zed', receiverUid: 'amy', source: 'admin_offer', bookingId: 'B1', nowMs: now, parseSlotId }), 'written');
  assert.equal(t.writes[0].path, 'calls/call_amy_zed');
  assert.equal(t.writes[0].merge, false);
  assert.equal(t.writes[0].data.status, 'accepted');
  assert.equal(t.writes[0].data.bookingId, 'B1');
  assert.equal(t.writes[0].data.callerId, 'zed');
  t = fakeTx();
  assert.equal(b.planCallDocTx(t.tx, db, { callSnap: snap(null), slot: far, callerUid: 'zed', receiverUid: 'amy', source: 'x', bookingId: 'B2', nowMs: now, parseSlotId }), 'deferred');
  assert.equal(t.writes.length, 0);
});

test('call doc: a live call is never touched, a stale pre-written one is closed', () => {
  const far = slotAt('2026-10-07', 20);
  const ts = (ms) => ({ toMillis: () => ms });
  let t = fakeTx();
  const live = { status: 'accepted', connectedAt: ts(now - 60000), slotId: '2026-10-05-10' };
  assert.equal(b.planCallDocTx(t.tx, db, { callSnap: snap(live), slot: slotAt('2026-10-05', 10), callerUid: 'a', receiverUid: 'b', source: 'x', bookingId: 'B', nowMs: now, parseSlotId }), 'live');
  assert.equal(t.writes.length, 0);
  t = fakeTx();
  const stale = { status: 'accepted', slotId: '2026-10-06-20' }; // an old booking's doc, written days ahead
  assert.equal(b.planCallDocTx(t.tx, db, { callSnap: snap(stale), slot: far, callerUid: 'a', receiverUid: 'b', source: 'x', bookingId: 'B', nowMs: now, parseSlotId }), 'closed-stale');
  assert.deepEqual(t.writes[0], { path: 'calls/call_a_b', data: { status: 'cancelled' }, merge: true });
  t = fakeTx();
  const imminent = { status: 'accepted', slotId: '2026-10-05-10' }; // prepared for a call starting now
  assert.equal(b.planCallDocTx(t.tx, db, { callSnap: snap(imminent), slot: far, callerUid: 'a', receiverUid: 'b', source: 'x', bookingId: 'B', nowMs: now, parseSlotId }), 'deferred');
  assert.equal(t.writes.length, 0);
  t = fakeTx();
  const ended = { status: 'ended', slotId: '2026-10-04-20' };
  assert.equal(b.planCallDocTx(t.tx, db, { callSnap: snap(ended), slot: far, callerUid: 'a', receiverUid: 'b', source: 'x', bookingId: 'B', nowMs: now, parseSlotId }), 'deferred');
  assert.equal(t.writes.length, 0);
});

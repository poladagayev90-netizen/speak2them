const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('./arrivals');

const M = 60000;
const start = Date.parse('2026-11-23T20:00:00+04:00');
const end = start + 120 * M;
const parseSlotId = (id) => {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(String(id || ''));
  if (!m) return null;
  const startMs = Date.parse(`${m[1]}T${m[2]}:00:00+04:00`);
  return { slotId: id, startMs, endMs: startMs + 120 * M };
};
const hours = Array.from({ length: 17 }, (_, i) => 7 + i);

test('lateMinutes: whole minutes after the start, early is 0', () => {
  assert.equal(a.lateMinutes(start - 5 * M, start), 0);
  assert.equal(a.lateMinutes(start + 59 * 1000, start), 0);
  assert.equal(a.lateMinutes(start + 12 * M + 30000, start), 12);
  assert.equal(a.lateMinutes(0, start), null);
});

test('arrivalFor: the server first token wins over the app arrivedAt', () => {
  const r = a.arrivalFor({ serverAt: start + 3 * M, clientAt: start + 40 * M, startMs: start, endMs: end });
  assert.deepEqual(r, { atMs: start + 3 * M, lateMin: 3, source: 'server' });
});

test('arrivalFor: falls back to the app arrivedAt (Firestore-like timestamp)', () => {
  const clientAt = { toMillis: () => start + 15 * M };
  assert.deepEqual(a.arrivalFor({ serverAt: null, clientAt, startMs: start, endMs: end }),
    { atMs: start + 15 * M, lateMin: 15, source: 'client' });
});

test('arrivalFor: a token outside the block is not an arrival', () => {
  assert.equal(a.arrivalFor({ serverAt: start - 3 * 3600000, clientAt: null, startMs: start, endMs: end }), null);
  assert.equal(a.arrivalFor({ serverAt: end + M, clientAt: null, startMs: start, endMs: end }), null);
  // 30 min early still counts, as on time.
  assert.equal(a.arrivalFor({ serverAt: start - 30 * M, startMs: start, endMs: end }).lateMin, 0);
});

test('candidateSlotIds: the blocks whose window holds now (hourly starts, 2 h long)', () => {
  const now = Date.parse('2026-11-23T20:40:00+04:00');
  const ids = a.candidateSlotIds(now, { dates: ['2026-11-22', '2026-11-23', '2026-11-24'], hours, parseSlotId });
  assert.deepEqual(ids, ['2026-11-23-19', '2026-11-23-20', '2026-11-23-21']);
  // Past midnight: only yesterday's 23:00 block is still on.
  const late = Date.parse('2026-11-24T00:10:00+04:00');
  assert.deepEqual(a.candidateSlotIds(late, { dates: ['2026-11-23', '2026-11-24', '2026-11-25'], hours, parseSlotId }), ['2026-11-23-23']);
});

test('bookingArrivalMap: null only for a no-show; a held call with no time is left out', () => {
  const arrival = { polad: { atMs: start, lateMin: 0, source: 'server' } };
  assert.deepEqual(a.bookingArrivalMap(['polad', 'emil'], arrival, { polad: 'partner_no_show', emil: 'no_show' }),
    { polad: arrival.polad, emil: null });
  assert.deepEqual(a.bookingArrivalMap(['x', 'y'], {}, { x: 'attended', y: 'arrived' }), {});
});

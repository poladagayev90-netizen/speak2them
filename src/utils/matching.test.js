import {
  closedOffers, weekBlocks, blockFitMin, weekPairs, plannedCount, busyInBlock, levelGap, candidatesFor, FIT_MIN,
  weekStarts, startFitMin, busyAround, START_FIT_MIN,
} from './matching';
import { parseSlotId } from './practiceSlots';

const MON = '2026-10-05';
// Wed 7 Oct 2026, 22:00 Baku block. Wednesday = 3.
const wed22 = { slotId: '2026-10-07-22', date: '2026-10-07', hour: 22, day: 3 };
const wedEvening = [[3 * 1440 + 20 * 60, 3 * 1440 + 24 * 60]];

test('weekBlocks: 7 days x 8 blocks, bookable only inside the horizon and lead time', () => {
  const now = Date.parse('2026-10-04T08:00:00Z');
  const blocks = weekBlocks(MON, now);
  expect(blocks).toHaveLength(56);
  expect(blocks[0].slotId).toBe('2026-10-05-08');
  expect(blocks[0].day).toBe(1);
  expect(blocks.every((b) => b.bookable)).toBe(true);
  // A week later the first days are out of reach (9 days).
  const far = weekBlocks('2026-10-19', now);
  expect(far.some((b) => b.bookable)).toBe(false);
  // Blocks already started cannot be proposed.
  const mid = weekBlocks(MON, Date.parse('2026-10-07T12:00:00Z'));
  expect(mid.find((b) => b.slotId === '2026-10-05-20').bookable).toBe(false);
});

test('blockFitMin counts only the free part of the two hours', () => {
  expect(blockFitMin(wedEvening, wed22)).toBe(120);
  expect(blockFitMin([[3 * 1440 + 23 * 60, 4 * 1440]], wed22)).toBe(60);
  expect(blockFitMin([], wed22)).toBe(0);
});

test('weekPairs: bookings and open offers, a confirmed offer listed once', () => {
  const bookings = [
    { id: 'bk1', slotId: '2026-10-07-22', startMs: 2, status: 'confirmed', participants: ['aziz', 'sabina'], names: { aziz: 'Aziz', sabina: 'Sabina' } },
    { id: 'bk2', slotId: '2026-10-06-20', startMs: 1, status: 'cancelled', participants: ['x', 'y'] },
  ];
  const offers = [
    { id: 'o1', status: 'confirmed', slotId: '2026-10-07-22', startMs: 2, userA: 'sabina', userB: 'aziz' },
    { id: 'o2', status: 'pending', slotId: '2026-10-08-22', startMs: 3, userA: 'nisa', userB: 'yunus', responses: { nisa: 'accepted', yunus: 'pending' } },
    { id: 'o3', status: 'declined', slotId: '2026-10-09-20', startMs: 4, userA: 'a', userB: 'b' },
  ];
  const pairs = weekPairs(offers, bookings);
  expect(pairs.map((p) => p.kind)).toEqual(['booked', 'pending']);
  expect(pairs[1].accepted).toEqual({ nisa: true, yunus: false });
  expect(plannedCount(pairs, 'sabina')).toBe(1);
  expect([...busyInBlock(pairs, '2026-10-07-22')].sort()).toEqual(['aziz', 'sabina']);
});

test('levelGap reads the short level from either form', () => {
  expect(levelGap('B1 – Intermediate', 'A2')).toBe(1);
  expect(levelGap('B1', null)).toBe(null);
});

test('candidatesFor: free that hour first, not busy, close level, in the list', () => {
  const people = [
    { id: 'sabina', name: 'Sabina', level: 'B1', baku: wedEvening, wants: 2, inList: true },
    { id: 'aziz', name: 'Aziz', level: 'B1', baku: wedEvening, wants: 2, inList: true },
    { id: 'yunus', name: 'Yunus', level: 'B1', baku: wedEvening, wants: 3, inList: true },
    { id: 'rumeysa', name: 'Rumeysa', level: 'A2', baku: wedEvening, wants: 2, inList: true },
    { id: 'late', name: 'Late', level: 'B1', baku: wedEvening, wants: 2, inList: false },
    { id: 'morning', name: 'Morning', level: 'B1', baku: [[3 * 1440 + 8 * 60, 3 * 1440 + 10 * 60]], wants: 2, inList: true },
  ];
  const pairs = weekPairs([], [
    { id: 'bk1', slotId: wed22.slotId, startMs: 1, status: 'confirmed', participants: ['aziz', 'sabina'] },
  ]);
  const list = candidatesFor({ keepId: 'sabina', block: wed22, people, pairs });
  expect(list.map((p) => p.id)).toEqual(['yunus', 'rumeysa', 'late']);
  expect(list[0].fit).toBeGreaterThanOrEqual(FIT_MIN);
  const all = candidatesFor({ keepId: 'sabina', block: wed22, people, pairs, all: true });
  expect(all.map((p) => p.id)).toContain('morning');
  expect(all[all.length - 1].id).toBe('morning');
});

test('closedOffers: unanswered proposals that can be sent again, not ones already replaced', () => {
  const offers = [
    { id: 'x1', status: 'expired', slotId: '2026-10-07-22', startMs: 2, userA: 'aziz', userB: 'sabina' },
    { id: 'x2', status: 'expired', slotId: '2026-10-08-22', startMs: 3, userA: 'nisa', userB: 'yunus' },
    { id: 'x3', status: 'cancelled', slotId: '2026-10-09-20', startMs: 4, userA: 'a', userB: 'b' },
    { id: 'p1', status: 'pending', slotId: '2026-10-07-22', startMs: 2, userA: 'yunus', userB: 'sabina' },
  ];
  const pairs = weekPairs(offers, []);
  const closed = closedOffers(offers, pairs);
  expect(closed.map((c) => c.offerId)).toEqual(['x2']);
  expect(closed[0].kind).toBe('expired');
});

test('weekStarts: every whole hour 07–23, 17 a day', () => {
  const s = weekStarts(MON, Date.parse('2026-10-01T00:00:00Z'));
  expect(s.length).toBe(7 * 17);
  expect(s[0].slotId).toBe(`${MON}-07`);
  expect(s.some((x) => x.slotId === `${MON}-11`)).toBe(true);
  expect(s[16].slotId).toBe(`${MON}-23`);
});

test('startFitMin: free minutes in a row from the start, at most two hours', () => {
  const wed = 3 * 1440;
  const free1112 = [[wed + 11 * 60, wed + 12 * 60]];
  expect(startFitMin(free1112, { day: 3, hour: 11 })).toBe(60);
  expect(startFitMin(free1112, { day: 3, hour: 10 })).toBe(0);
  expect(startFitMin([[wed + 18 * 60, wed + 19 * 60], [wed + 19 * 60, wed + 23 * 60]], { day: 3, hour: 18 })).toBe(120);
  expect(START_FIT_MIN).toBe(30);
});

test('busyAround: a practice two hours either side counts, further does not', () => {
  const H = 3600000;
  const pairs = [{ a: 'x', b: 'y', startMs: 20 * H }];
  expect([...busyAround(pairs, 21 * H)].sort()).toEqual(['x', 'y']);
  expect([...busyAround(pairs, 19 * H)].sort()).toEqual(['x', 'y']);
  expect(busyAround(pairs, 22 * H).size).toBe(0);
  expect(busyAround(pairs, 18 * H).size).toBe(0);
});

test('parseSlotId takes any whole hour 07–23 and nothing else', () => {
  expect(parseSlotId('2026-10-14-11').hour).toBe(11);
  expect(parseSlotId('2026-10-14-23').endMs - parseSlotId('2026-10-14-23').startMs).toBe(2 * 3600000);
  expect(parseSlotId('2026-10-14-06')).toBeNull();
  expect(parseSlotId('2026-10-14-20').hour).toBe(20);
});

// ── Hourly free grid (2026-10-18) ──
const { freeGrid, subtractIntervals, weekRanges, attentionOf } = require('./matching');
const eveningsMonFri = [1, 2, 3, 4, 5].map((day) => ({ day, startMin: 19 * 60, endMin: 22 * 60 }));
const cellOf = (g, i, hour) => g.rows[i].cells.find((c) => c.hour === hour);

test('freeGrid: Mon–Fri 19–22 lights 19, 20, 21 — not 18, not 22', () => {
  const g = freeGrid({ onboarding: { availability: eveningsMonFri, timeZone: 'Asia/Baku' }, monday: MON, uid: 'u' });
  expect(g.rows).toHaveLength(7);
  expect(g.rows[0].cells.map((c) => c.hour)).toEqual(Array.from({ length: 17 }, (_, i) => i + 7));
  for (const i of [0, 1, 2, 3, 4]) {
    expect([18, 19, 20, 21, 22].map((h) => cellOf(g, i, h).state)).toEqual(['', 'free', 'free', 'free', '']);
  }
  expect(g.rows[5].cells.every((c) => !c.state)).toBe(true); // Saturday
  expect(g.free).toBe(15);
});

test('freeGrid: another time zone is shown on the Baku clock', () => {
  // Istanbul is Baku − 1 h: 19–22 there is 20–23 Baku.
  const g = freeGrid({ onboarding: { availability: eveningsMonFri, timeZone: 'Europe/Istanbul' }, monday: MON, uid: 'u' });
  expect([19, 20, 22, 23].map((h) => cellOf(g, 0, h).state)).toEqual(['', 'free', 'free', '']);
});

test('freeGrid: this week\'s picked hours replace the usual ones, minus Never', () => {
  const ob = {
    availability: eveningsMonFri, timeZone: 'Asia/Baku',
    busyAvailability: [{ day: 3, startMin: 20 * 60, endMin: 21 * 60 }],
    weeks: { [MON]: { hours: { 3: [20, 21], 6: [10] } } },
  };
  const g = freeGrid({ onboarding: ob, monday: MON, uid: 'u' });
  expect(g.picked).toBe(true);
  expect(cellOf(g, 2, 20).state).toBe('');        // picked, but «Never»
  expect(cellOf(g, 2, 21).state).toBe('picked');
  expect(cellOf(g, 5, 10).state).toBe('picked');  // Saturday, not a usual day
  expect(cellOf(g, 0, 19).state).toBe('off');     // usual Monday, not picked
});

test('freeGrid: a week off lights nothing; Maybe is an outline; a practice shows at its own hour', () => {
  const off = freeGrid({ onboarding: { availability: eveningsMonFri, weeks: { [MON]: { skip: true } } }, monday: MON, uid: 'u' });
  expect(off.skip).toBe(true);
  expect(off.free).toBe(0);
  const ob = { availability: eveningsMonFri, maybeAvailability: [{ day: 6, startMin: 600, endMin: 720 }] };
  const pairs = [{ a: 'u', b: 'v', slotId: '2026-10-07-19', kind: 'booked' }];
  const g = freeGrid({ onboarding: ob, monday: MON, uid: 'u', pairs });
  expect(cellOf(g, 5, 10).maybe).toBe(true);
  expect(cellOf(g, 5, 10).state).toBe('');
  expect(cellOf(g, 2, 19).state).toBe('pair');
  expect(cellOf(g, 2, 19).kind).toBe('booked');
  expect(cellOf(g, 1, 19).state).toBe('free');
});

test('weekRanges: picked days narrow the usual times', () => {
  const r = weekRanges({ availability: eveningsMonFri, weeks: { [MON]: { days: [2, 4] } } }, MON);
  expect(r.week.map((x) => x.day)).toEqual([2, 4]);
  expect(r.picked).toBe(true);
});

test('subtractIntervals cuts holes', () => {
  expect(subtractIntervals([[0, 100]], [[10, 20], [50, 200]])).toEqual([[0, 10], [20, 50]]);
  expect(subtractIntervals([[0, 10]], [])).toEqual([[0, 10]]);
});

test('attentionOf: the five flags', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  const a = attentionOf({ inWeek: true, planned: 0, calls: 0, joinedMs: now - 86400000, paid: true, why: 'snoozed', reliability: 'limited', whatsapp: '' }, now);
  expect(a).toEqual({ noPlan: true, newNoFirst: true, paidAsleep: true, limited: true, noWhatsApp: true });
  const b = attentionOf({ inWeek: true, planned: 1, calls: 3, joinedMs: 0, paid: true, why: 'package', health: 'active', reliability: 'ok', whatsapp: '+99450' }, now);
  expect(Object.values(b).some(Boolean)).toBe(false);
  // An old account that never practised is not «new».
  expect(attentionOf({ calls: 0, joinedMs: now - 40 * 86400000, whatsapp: 'x' }, now).newNoFirst).toBe(false);
});

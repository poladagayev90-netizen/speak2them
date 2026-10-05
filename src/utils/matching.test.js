import {
  closedOffers, weekBlocks, blockFitMin, weekPairs, plannedCount, busyInBlock, levelGap, candidatesFor, FIT_MIN,
} from './matching';

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

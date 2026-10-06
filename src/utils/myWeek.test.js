import {
  weekDays, weekAnswer, calendarDays, suggestDays, autoIn, checkinFor, dayNames, bakuWeekKey, addDaysKey,
  popularBlocks, popularSuggestion, parseHours, cellsToHours, weekCells, hourAhead,
} from './myWeek';

const at = (s) => Date.parse(s);
const evenings = [1, 2, 3, 4, 5].map((day) => ({ day, startMin: 1200, endMin: 1320 }));
const ob = { availability: evenings, weeklyTarget: 2, charterAcceptedAt: { seconds: at('2026-09-01T12:00:00+04:00') / 1000 } };

test('week keys and days', () => {
  expect(bakuWeekKey(at('2026-10-14T12:00:00+04:00'))).toBe('2026-10-12');
  expect(bakuWeekKey(at('2026-10-18T23:30:00+04:00'))).toBe('2026-10-12');
  expect(addDaysKey('2026-10-12', 7)).toBe('2026-10-19');
  const d = weekDays('2026-10-12');
  expect(d.map((x) => x.wd)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  expect(d[0].num).toBe(12);
});

test('the week answer', () => {
  const o = { weeks: { '2026-10-12': { days: [1, 3] }, '2026-10-19': { skip: true } } };
  expect(weekAnswer(o, '2026-10-12')).toEqual({ in: true, days: [1, 3] });
  expect(weekAnswer(o, '2026-10-19')).toEqual({ in: false });
  expect(weekAnswer(o, '2026-10-26')).toBeNull();
});

test('calendar states: booked, offered, past, no free time, picked', () => {
  const now = at('2026-10-14T09:00:00');
  const bookings = [{ status: 'confirmed', startMs: at('2026-10-15T20:00:00') }];
  const offers = [{ startMs: at('2026-10-16T20:00:00') }];
  const days = calendarDays({ monday: '2026-10-12', onboarding: ob, bookings, offers, picked: [3], now });
  expect(days.map((d) => d.state)).toEqual(['past', 'past', 'picked', 'booked', 'offered', 'none', 'none']);
  expect(days[2].isToday).toBe(true);
});

test('suggested days: free days still ahead, spread, as many as usual', () => {
  expect(suggestDays({ monday: '2026-10-19', onboarding: ob, now: at('2026-10-17T12:00:00') })).toEqual([1, 3]);
  expect(suggestDays({ monday: '2026-10-12', onboarding: ob, now: at('2026-10-16T09:00:00') })).toEqual([5]);
  expect(suggestDays({ monday: '2026-10-12', onboarding: { ...ob, weeklyTarget: 3 }, now: at('2026-10-12T09:00:00') })).toEqual([1, 2, 4]);
});

test('who is in without answering', () => {
  expect(autoIn({ onboarding: ob, access: { kind: 'package' }, monday: '2026-10-12' })).toBe(true);
  expect(autoIn({ onboarding: ob, access: { kind: 'trial' }, monday: '2026-10-12' })).toBe(false);
  const fresh = { ...ob, charterAcceptedAt: { seconds: at('2026-10-11T10:00:00+04:00') / 1000 } };
  expect(autoIn({ onboarding: fresh, monday: '2026-10-12' })).toBe(true);
});

test('the check-in: weekend → next week, weekday → this week, never twice', () => {
  const sat = at('2026-10-17T12:00:00+04:00');
  expect(checkinFor({ onboarding: ob, now: sat })).toMatchObject({ monday: '2026-10-19', next: true, days: [1, 3] });
  const wed = at('2026-10-14T12:00:00+04:00');
  expect(checkinFor({ onboarding: ob, now: wed })).toMatchObject({ monday: '2026-10-12', next: false });
  expect(checkinFor({ onboarding: { ...ob, weeks: { '2026-10-12': { skip: true } } }, now: wed })).toBeNull();
  expect(checkinFor({ onboarding: ob, access: { kind: 'package' }, now: wed })).toBeNull();
  expect(checkinFor({ onboarding: ob, auto: { week: '2026-10-12', in: true, why: 'regular' }, now: wed })).toBeNull();
  expect(checkinFor({ onboarding: ob, auto: { week: '2026-10-12', in: false, why: 'not_confirmed' }, now: wed })).not.toBeNull();
  expect(checkinFor({ onboarding: { ...ob, planPaused: true }, now: wed })).toBeNull();
  expect(checkinFor({ onboarding: ob, now: at('2026-10-16T19:00:00+04:00') })).toBeNull(); // Friday evening
  expect(dayNames([0, 3, 1])).toBe('Mon, Wed, Sun');
});

test('popular times in the learner\'s own clock', () => {
  const cells = { '2-20': 9, '4-20': 9, '1-10': 12, '3-18': 4 };
  const baku = popularBlocks(cells, 0);
  expect(baku.map((b) => b.key)).toEqual(['1-10', '2-20', '4-20', '3-18']);
  // Istanbul is an hour behind Baku: Tue 20:00 Baku = Tue 19:00 there.
  expect(popularBlocks(cells, -60)[1]).toMatchObject({ day: 2, startMin: 1140 });
  // Already free on Monday morning → the next one.
  const avail = [{ day: 1, startMin: 540, endMin: 720 }];
  expect(popularSuggestion(cells, avail, 0)).toMatchObject({ day: 2, startMin: 1200, endMin: 1320, label: 'Tue 20:00' });
  expect(popularSuggestion({}, avail, 0)).toBeNull();
});

test('picked hours: parsed, shown on the grid, and a day counts only while an hour is ahead', () => {
  expect(parseHours({ 3: [21, 20, 20], 9: [1], 2: ['x'] })).toEqual({ 3: [20, 21] });
  expect(parseHours(null)).toBeNull();
  const o = { ...ob, weeks: { '2026-10-12': { days: [3, 6], hours: { 3: [20], 6: [11, 12] } } } };
  expect(weekAnswer(o, '2026-10-12')).toEqual({ in: true, days: [3, 6], hours: { 3: [20], 6: [11, 12] } });
  const cells = weekCells({ monday: '2026-10-12', onboarding: o, now: at('2026-10-12T09:00:00') });
  expect([...cells].sort()).toEqual(['3-20', '6-11', '6-12']);
  expect(cellsToHours(cells)).toEqual({ 3: [20], 6: [11, 12] });
  // An answer from before the grid: their usual hours on those days.
  const old = { ...ob, weeks: { '2026-10-12': { days: [2] } } };
  expect([...weekCells({ monday: '2026-10-12', onboarding: old })].sort()).toEqual(['2-20', '2-21']);
  // Wednesday 20:20: 20:00 has gone (a start needs 30 min ahead), 21:00 is still open.
  const late = at('2026-10-14T20:20:00');
  expect(hourAhead('2026-10-14', 21, late)).toBe(true);
  expect(hourAhead('2026-10-14', 20, late)).toBe(false);
  const days = calendarDays({ monday: '2026-10-12', onboarding: o, cells, now: late });
  expect(days.map((d) => d.state)).toEqual(['past', 'past', 'free', 'free', 'free', 'picked', 'none']);
  expect(days[5].hours).toEqual([11, 12]);
});

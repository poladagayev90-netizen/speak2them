import { bakuDayHour, hoursLabel, lastDates } from './presenceLog';
import { lastSeenLabel } from './presence';

jest.mock('../firebase', () => ({ db: {} }));

test('Baku day and hour, UTC+4 with no DST', () => {
  // 2026-10-07 20:30 UTC = 2026-10-08 00:30 in Baku.
  expect(bakuDayHour(Date.UTC(2026, 9, 7, 20, 30))).toEqual({ date: '2026-10-08', hour: 0 });
  expect(bakuDayHour(Date.UTC(2026, 9, 7, 15, 59))).toEqual({ date: '2026-10-07', hour: 19 });
});

test('hours read as short runs', () => {
  expect(hoursLabel([21, 20, 22, 9])).toBe('09–10, 20–23');
  expect(hoursLabel([23])).toBe('23–00');
  expect(hoursLabel([])).toBe('');
});

test('the last dates, newest first', () => {
  expect(lastDates(3, Date.UTC(2026, 9, 7, 12))).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
});

test('last seen in words', () => {
  const now = Date.UTC(2026, 9, 7, 12);
  expect(lastSeenLabel(0, now)).toBe('never seen');
  expect(lastSeenLabel(now - 60000, now)).toBe('just now');
  expect(lastSeenLabel(now - 25 * 60000, now)).toBe('25 min ago');
  expect(lastSeenLabel(now - 5 * 3600000, now)).toBe('5 h ago');
  expect(lastSeenLabel(now - 30 * 3600000, now)).toBe('yesterday');
  expect(lastSeenLabel(now - 6 * 86400000, now)).toBe('6 days ago');
});

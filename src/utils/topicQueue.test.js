import { upcomingTopics, topicDayLabel } from './topicQueue';

// Monday 5 Oct 2026, 15:00 Baku.
const NOW = Date.parse('2026-10-05T15:00:00+04:00');

test('every day active: next topics fall on the following days', () => {
  const list = upcomingTopics({ currentIndex: 4, total: 28, count: 3, config: { sessionDays: [0, 1, 2, 3, 4, 5, 6], bonusDays: [] }, nowMs: NOW });
  expect(list.map((t) => t.index)).toEqual([5, 6, 7]);
  expect(list.map((t) => t.label)).toEqual(['Tomorrow', 'Wed 7 Oct', 'Thu 8 Oct']);
});

test('Mon/Wed/Fri + Sun: the topic waits for the next active day', () => {
  const list = upcomingTopics({ currentIndex: 10, total: 28, count: 3, config: { sessionDays: [1, 3, 5], bonusDays: [0] }, nowMs: NOW });
  expect(list.map((t) => t.dateStr)).toEqual(['2026-10-07', '2026-10-09', '2026-10-11']);
  expect(list.map((t) => t.index)).toEqual([11, 12, 13]);
});

test('wraps around the end of the cycle', () => {
  const list = upcomingTopics({ currentIndex: 27, total: 28, count: 2, nowMs: NOW });
  expect(list.map((t) => t.index)).toEqual([0, 1]);
});

test('never lists the current topic again, nor more than the cycle', () => {
  expect(upcomingTopics({ currentIndex: 0, total: 3, count: 10, nowMs: NOW })).toHaveLength(2);
  expect(upcomingTopics({ currentIndex: 0, total: 0, nowMs: NOW })).toEqual([]);
  expect(upcomingTopics({ currentIndex: 0, total: 28, config: { sessionDays: [], bonusDays: [] }, nowMs: NOW })).toEqual([]);
});

test('day labels', () => {
  expect(topicDayLabel('2026-10-05', '2026-10-05')).toBe('Today');
  expect(topicDayLabel('2026-10-06', '2026-10-05')).toBe('Tomorrow');
  expect(topicDayLabel('2026-11-01', '2026-10-05')).toBe('Sun 1 Nov');
});

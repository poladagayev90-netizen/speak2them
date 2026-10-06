import { threadItems, dayLabel, canEditMessage, canDeleteForEveryone, timeLabel } from './chatThread';

const now = new Date(2026, 9, 6, 15, 0);
const at = (d, h, m) => new Date(2026, 9, d, h, m);

test('day lines and grouped runs', () => {
  const msgs = [
    { id: 'a', senderId: 'me', createdAt: at(5, 20, 0) },
    { id: 'b', senderId: 'me', createdAt: at(6, 14, 0) },
    { id: 'c', senderId: 'me', createdAt: at(6, 14, 1) },
    { id: 'd', senderId: 'you', createdAt: at(6, 14, 2) },
    { id: 'e', senderId: 'you', createdAt: at(6, 14, 30) },
  ];
  const items = threadItems(msgs, now);
  expect(items.map((i) => (i.type === 'day' ? i.label : i.key))).toEqual(['Yesterday', 'a', 'Today', 'b', 'c', 'd', 'e']);
  const byKey = Object.fromEntries(items.filter((i) => i.type === 'msg').map((i) => [i.key, i]));
  expect([byKey.b.first, byKey.b.last]).toEqual([true, false]);
  expect([byKey.c.first, byKey.c.last]).toEqual([false, true]);
  // 28 minutes apart → a new run.
  expect(byKey.e.first).toBe(true);
});

test('a message still being sent sits under today', () => {
  const items = threadItems([{ id: 'x', senderId: 'me', createdAt: null, pending: true }], now);
  expect(items[0].label).toBe('Today');
});

test('labels', () => {
  expect(dayLabel(at(1, 9, 0), now)).toBe('1 Oct');
  expect(dayLabel(new Date(2025, 11, 31), now)).toBe('31 Dec 2025');
  expect(timeLabel(at(6, 9, 5))).toBe('09:05');
});

test('edit only my own text within 15 minutes; delete only my own', () => {
  const nowMs = at(6, 14, 10).getTime();
  const mine = { senderId: 'me', createdAt: at(6, 14, 0) };
  expect(canEditMessage(mine, 'me', nowMs)).toBe(true);
  expect(canEditMessage({ ...mine, createdAt: at(6, 13, 50) }, 'me', nowMs)).toBe(false);
  expect(canEditMessage(mine, 'you', nowMs)).toBe(false);
  expect(canEditMessage({ ...mine, kind: 'analysis' }, 'me', nowMs)).toBe(false);
  expect(canEditMessage({ ...mine, deleted: true }, 'me', nowMs)).toBe(false);
  expect(canDeleteForEveryone(mine, 'me')).toBe(true);
  expect(canDeleteForEveryone(mine, 'you')).toBe(false);
});

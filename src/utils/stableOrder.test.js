import { stableOrder } from './stableOrder';

const byScore = (a, b) => b.score - a.score;

test('first appearance is sorted, later changes do not reorder', () => {
  const rank = new Map();
  expect(stableOrder([{ id: 'a', score: 1 }, { id: 'b', score: 5 }], byScore, rank).map((i) => i.id)).toEqual(['b', 'a']);
  // a's score jumps (e.g. lastSeen updated) — it stays where it was.
  expect(stableOrder([{ id: 'a', score: 9 }, { id: 'b', score: 5 }], byScore, rank).map((i) => i.id)).toEqual(['b', 'a']);
});

test('new items go to the end; a fresh rank map sorts again', () => {
  const rank = new Map();
  stableOrder([{ id: 'a', score: 1 }], byScore, rank);
  expect(stableOrder([{ id: 'a', score: 1 }, { id: 'c', score: 7 }], byScore, rank).map((i) => i.id)).toEqual(['a', 'c']);
  expect(stableOrder([{ id: 'a', score: 1 }, { id: 'c', score: 7 }], byScore, new Map()).map((i) => i.id)).toEqual(['c', 'a']);
});

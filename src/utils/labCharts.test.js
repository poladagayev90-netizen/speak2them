import { minutesPerSession, wpmPerSession, wordsOverTime, cefrIndex } from './labCharts';

// The stored series is newest-first.
const doc = {
  wordCount: 100,
  series: [
    { seconds: 600, wpm: 80, nw: 10 },
    { seconds: 300, wpm: 0, nw: 20 },
    { seconds: 125, wpm: 70, nw: 5 },
  ],
};

test('minutes and pace are oldest-first, and a missing pace is skipped', () => {
  expect(minutesPerSession(doc)).toEqual([2, 5, 10]);
  expect(wpmPerSession(doc)).toEqual([70, 80]);
});

test('words over time walk back from the running total', () => {
  expect(wordsOverTime(doc)).toEqual([70, 90, 100]);
});

test('an entry without new-word data stops the walk instead of guessing', () => {
  const d = { wordCount: 50, series: [{ nw: 5 }, {}, { nw: 3 }] };
  expect(wordsOverTime(d)).toEqual([45, 50]);
  expect(wordsOverTime({ series: [] })).toEqual([]);
});

test('the level comes only from a real CEFR label', () => {
  expect(cefrIndex('B1 – Intermediate')).toBe(2);
  expect(cefrIndex('')).toBe(-1);
  expect(cefrIndex(undefined)).toBe(-1);
});

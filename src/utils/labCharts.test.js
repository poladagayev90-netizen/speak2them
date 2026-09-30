import { minutesPerSession, wpmPerSession, wordsOverTime, cefrIndex, sessionTitle, defaultSession, sessionTrend } from './labCharts';

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

// ─── session picker ─────────────────────────────────────────────────

const list = [
  { id: 'e', error: 'x' },
  { id: 'd', overallScore: 70, scores: { grammar: 60 }, peerName: 'Nisa' },
  { id: 'c', overallScore: 65, scores: { grammar: 55 }, source: 'ainur', activity: 'debate' },
  { id: 'b', overallScore: 0 },
  { id: 'a', overallScore: 60, scores: { grammar: 50 } },
];

test('titles name the partner, AInur activity, or topic', () => {
  expect(sessionTitle(list[1])).toBe('Call with Nisa');
  expect(sessionTitle(list[2])).toBe('AInur · Debate');
  expect(sessionTitle({ topicTitle: 'Job and interviews', peerName: 'Nisa' })).toBe('Job and interviews');
});

test('the lab opens on the newest finished session, else the totals', () => {
  expect(defaultSession(list)).toBe('d');
  expect(defaultSession([{ id: 'x', error: 'y' }])).toBe('all');
  expect(defaultSession([])).toBe('all');
});

test('a trend ends at the chosen session and skips unfinished ones', () => {
  expect(sessionTrend(list, 'd', (a) => a.scores.grammar)).toEqual([50, 55, 60]);
  expect(sessionTrend(list, 'c', (a) => a.scores.grammar)).toEqual([50, 55]);
  expect(sessionTrend(list, 'zz', (a) => a.overallScore)).toEqual([]);
});

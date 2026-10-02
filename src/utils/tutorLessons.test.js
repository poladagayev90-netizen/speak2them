import { episodeFor, homeworkStepKeys, nextLesson, packageSummary } from './tutorLessons';

const t = (iso) => Date.parse(iso);
const lessons = [
  { id: 'a', at: t('2026-10-06T19:00:00+04:00'), status: 'held', n: 1 },
  { id: 'b', at: t('2026-10-08T19:00:00+04:00'), status: 'cancelled' },
  { id: 'c', at: t('2026-10-13T19:00:00+04:00'), status: 'planned' },
  { id: 'd', at: t('2026-10-15T19:00:00+04:00'), status: 'planned' },
];

test('the next lesson skips held and cancelled ones', () => {
  expect(nextLesson(lessons, t('2026-10-07T10:00:00+04:00')).id).toBe('c');
});

test('a lesson in progress is still next; two hours later it is not', () => {
  expect(nextLesson(lessons, t('2026-10-13T19:30:00+04:00')).id).toBe('c');
  expect(nextLesson(lessons, t('2026-10-13T21:30:00+04:00')).id).toBe('d');
  expect(nextLesson(lessons, t('2026-10-20T10:00:00+04:00'))).toBe(null);
});

test('only held lessons use the package', () => {
  expect(packageSummary({ packageSize: 8 }, lessons)).toEqual({ held: 1, size: 8, planned: 2, left: 7 });
});

test('a planned lesson goes with the episode after the held ones before it', () => {
  expect(episodeFor(lessons[0], lessons)).toBe(1);
  expect(episodeFor(lessons[2], lessons)).toBe(2);
  expect(episodeFor(lessons[3], lessons)).toBe(2);
});

test('homework steps: "your mistakes" only with something in it', () => {
  expect(homeworkStepKeys(null)).toEqual(['words', 'dictation', 'speak']);
  expect(homeworkStepKeys({ words: [{ word: 'x' }] })).toEqual(['words', 'dictation', 'mine', 'speak']);
});

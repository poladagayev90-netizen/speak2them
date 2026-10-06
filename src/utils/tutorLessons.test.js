import { episodeFor, homeworkStepKeys, lessonItems, mergeSchedule, nextLesson, packageSummary, teachingItems } from './tutorLessons';

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

test("a lesson's number counts the lessons before it that were not cancelled", () => {
  expect(episodeFor(lessons[0], lessons)).toBe(1);
  expect(episodeFor(lessons[2], lessons)).toBe(2);
  expect(episodeFor(lessons[3], lessons)).toBe(3);
});

test('homework steps: "your mistakes" only with something in it', () => {
  expect(homeworkStepKeys(null)).toEqual(['words', 'dictation', 'speak']);
  expect(homeworkStepKeys({ words: [{ word: 'x' }] })).toEqual(['words', 'dictation', 'mine', 'speak']);
});

test('lessons join the schedule next to bookings, in time order', () => {
  const now = t('2026-10-12T10:00:00+04:00');
  const items = lessonItems(lessons, now);
  expect(items.map((l) => [l.id, l.number, l.kind])).toEqual([['c', 2, 'lesson'], ['d', 3, 'lesson']]);
  const booking = { id: 'b1', startMs: t('2026-10-14T21:00:00+04:00') };
  expect(mergeSchedule([booking], items).map((x) => x.id)).toEqual(['c', 'b1', 'd']);
});

test('a teacher sees the lessons they teach, numbered per student', () => {
  const now = Date.parse('2026-10-06T12:00:00+04:00');
  const at = (h) => ({ toMillis: () => now + h * 3600e3 });
  const ls = [
    { id: 'a1', uid: 'A', status: 'held', n: 1, at: at(-48) },
    { id: 'a2', uid: 'A', status: 'planned', at: at(5) },
    { id: 'b1', uid: 'B', status: 'planned', at: at(3) },
    { id: 'b0', uid: 'B', status: 'cancelled', at: at(-20) },
    { id: 'old', uid: 'B', status: 'planned', at: at(-5) },
  ];
  const items = teachingItems(ls, now);
  expect(items.map((x) => [x.id, x.number, x.teaching])).toEqual([['b1', 2, true], ['a2', 2, true]]);
});

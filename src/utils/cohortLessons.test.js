import { homeworkStepKeys, isClassCohort, lessonDates, lessonSummary, topicsSinceJoin } from './cohortLessons';

// 2026-10-05 is a Monday. Lessons Tue + Thu at 19:00 Baku.
const klass = { lessonCount: 4, lessonDays: [2, 4], lessonMin: 19 * 60, startDate: '2026-10-05' };

test('an old cohort without a schedule is not a class', () => {
  expect(isClassCohort({ startTick: 3 })).toBe(false);
  expect(isClassCohort(klass)).toBe(true);
  expect(lessonDates({ startTick: 3 })).toEqual([]);
});

test('lessons fall on the class weekdays at the Baku time', () => {
  const d = lessonDates(klass);
  expect(d.map((l) => l.dateStr)).toEqual(['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15']);
  expect(d.map((l) => l.n)).toEqual([1, 2, 3, 4]);
  expect(new Date(d[0].startMs).toISOString()).toBe('2026-10-06T15:00:00.000Z');
});

test('the start date itself counts when it is a lesson day', () => {
  const d = lessonDates({ ...klass, startDate: '2026-10-06' });
  expect(d[0].dateStr).toBe('2026-10-06');
});

test('only lessons the teacher marked held are done', () => {
  const afterFirst = Date.parse('2026-10-07T10:00:00+04:00');
  const none = lessonSummary(klass, [], afterFirst);
  expect(none.held).toBe(0);
  // Lesson 1 was not marked held and is long over, so the next one is lesson 2.
  expect(none.next.n).toBe(2);

  const s = lessonSummary(klass, [{ n: 1, status: 'held', topicIndex: 7 }], afterFirst);
  expect(s.held).toBe(1);
  expect(s.lessons[0].topicIndex).toBe(7);
  expect(s.next.n).toBe(2);
  expect(s.ended).toBe(false);
});

test('a lesson in progress is still the next one', () => {
  const during = Date.parse('2026-10-06T19:30:00+04:00');
  expect(lessonSummary(klass, [], during).next.n).toBe(1);
});

test('the class ends two hours after the last lesson', () => {
  const s = lessonSummary(klass, [], Date.parse('2026-10-16T10:00:00+04:00'));
  expect(s.ended).toBe(true);
  expect(s.next).toBe(null);
});

test('the general course counts main days since the learner joined', () => {
  // Main days Mon/Wed/Fri + Sun. Joined Monday 2026-10-05; by Monday 2026-10-12
  // the cycle moved on Wed, Fri, Sun, Mon = 4 topics.
  const cfg = { sessionDays: [1, 3, 5], bonusDays: [0] };
  const user = { trialStartedAt: Date.parse('2026-10-05T10:00:00+04:00') };
  expect(topicsSinceJoin(user, cfg, 60, Date.parse('2026-10-12T12:00:00+04:00'))).toBe(4);
  expect(topicsSinceJoin({}, cfg, 60)).toBe(null);
  expect(topicsSinceJoin(user, cfg, 2, Date.parse('2026-10-12T12:00:00+04:00'))).toBe(2);
});

test('an approved story adds listening first and reading after the words', () => {
  expect(homeworkStepKeys(null)).toEqual(['words', 'dictation', 'speak']);
  expect(homeworkStepKeys({ words: [{ word: 'x' }] }, true))
    .toEqual(['listening', 'words', 'reading', 'dictation', 'mine', 'speak']);
});

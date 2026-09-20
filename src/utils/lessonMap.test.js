import {
  completedSet, isLessonDone, nextLesson, lessonAfter,
  moduleProgress, overallProgress, minutesLeft,
} from './lessonMap';
import { allLessons, lessonModules, lessonCount } from '../data/lessons';

const doneUpTo = (n) => ({
  completed: Object.fromEntries(allLessons.slice(0, n).map((l) => [l.id, 1700000000000])),
});

test('a missing or empty progress doc reads as nothing done', () => {
  expect(completedSet(null).size).toBe(0);
  expect(completedSet({}).size).toBe(0);
  expect(completedSet({ completed: null }).size).toBe(0);
  expect(nextLesson(null).id).toBe(allLessons[0].id);
  expect(overallProgress(null)).toEqual({ done: 0, total: lessonCount, percent: 0 });
});

test('the recommended lesson is the first one not done, in course order', () => {
  expect(nextLesson(doneUpTo(3)).id).toBe(allLessons[3].id);
  // A gap in the middle is respected: it points back at the gap, not forward.
  expect(nextLesson({ completed: { [allLessons[1].id]: 1 } }).id).toBe(allLessons[0].id);
});

test('nothing is left to recommend once every lesson is done', () => {
  const all = doneUpTo(lessonCount);
  expect(nextLesson(all)).toBe(null);
  expect(overallProgress(all).percent).toBe(100);
  expect(minutesLeft(all)).toBe(0);
});

test('percent never says 100 while a lesson is still open', () => {
  const allButOne = doneUpTo(lessonCount - 1);
  expect(overallProgress(allButOne).percent).toBeLessThan(100);
  expect(overallProgress(allButOne).done).toBe(lessonCount - 1);
  // Ids that are not lessons — a renamed or retired one — count for nothing
  // rather than inflating the bar past what the learner has read.
  const junk = { completed: Object.fromEntries(Array.from({ length: 99 }, (_, i) => [`gone-${i}`, 1])) };
  expect(overallProgress(junk)).toEqual({ done: 0, total: lessonCount, percent: 0 });
});

test('the next lesson crosses into the next module instead of stopping', () => {
  const firstModule = lessonModules[0];
  const lastOfFirst = firstModule.lessons[firstModule.lessons.length - 1].id;
  expect(lessonAfter(lastOfFirst).moduleId).toBe(lessonModules[1].id);
  expect(lessonAfter(allLessons[allLessons.length - 1].id)).toBe(null);
  expect(lessonAfter('no-such-lesson')).toBe(null);
});

test('a module is complete only when all of its own lessons are done', () => {
  const first = lessonModules[0];
  const partial = { completed: { [first.lessons[0].id]: 1 } };
  expect(moduleProgress(first.id, partial)).toEqual({ done: 1, total: first.lessons.length, complete: false });
  const whole = { completed: Object.fromEntries(first.lessons.map((l) => [l.id, 1])) };
  expect(moduleProgress(first.id, whole).complete).toBe(true);
  // Another module's ticks must not leak in.
  expect(moduleProgress(lessonModules[1].id, whole).done).toBe(0);
  expect(moduleProgress('nope', whole)).toEqual({ done: 0, total: 0, complete: false });
});

test('isLessonDone reads one lesson', () => {
  const p = doneUpTo(1);
  expect(isLessonDone(p, allLessons[0].id)).toBe(true);
  expect(isLessonDone(p, allLessons[1].id)).toBe(false);
});

test('every lesson id is unique — an id is a storage key, not a label', () => {
  expect(new Set(allLessons.map((l) => l.id)).size).toBe(lessonCount);
  expect(new Set(lessonModules.map((m) => m.id)).size).toBe(lessonModules.length);
});

test('every lesson carries the fields the reader renders', () => {
  allLessons.forEach((l) => {
    expect(typeof l.title).toBe('string');
    expect(l.title.length).toBeGreaterThan(0);
    expect(typeof l.why).toBe('string');
    expect(Array.isArray(l.cards)).toBe(true);
    expect(l.cards.length).toBeGreaterThan(0);
    l.cards.forEach((c) => {
      expect(typeof c.title).toBe('string');
      // A card has to carry something besides its title.
      expect(Boolean(c.body || c.phrases || c.example || c.trap || c.say)).toBe(true);
      (c.phrases || []).forEach((p) => {
        expect(typeof p.en).toBe('string');
        // Both translations, always: a chip with a meaning in one language and
        // not the other would be invisible to half the learners.
        expect(p.az.length).toBeGreaterThan(0);
        expect(p.tr.length).toBeGreaterThan(0);
      });
    });
  });
});

test('every module points at a practice activity that exists', () => {
  const routes = ['/practice', '/live', '/ai-chat'];
  lessonModules.forEach((m) => {
    expect(m.lessons.length).toBeGreaterThan(0);
    expect(routes).toContain(m.practice.to);
    expect(m.practice.label.length).toBeGreaterThan(0);
  });
});

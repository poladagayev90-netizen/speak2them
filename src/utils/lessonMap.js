import { allLessons, lessonModules, lessonCount } from '../data/lessons';

// Where a learner stands in the lessons. Pure arithmetic over one map of
// completed ids — no Firestore, no React, so it can be reasoned about and
// tested on its own (lessonMap.test.js).
//
// NOTHING HERE LOCKS ANYTHING. `nextLesson` is a recommendation and the map
// offers every lesson at any time; there is no "unlocked" concept to be found
// in this file on purpose. The one time the app did gate practice behind a
// checklist it had to be rolled back the same day.

// The map as stored: { 'describe-see': 1758300000000, … }. Missing doc, missing
// field and a doc written by an older build all have to read as "nothing done".
export function completedSet(progress) {
  const raw = progress && progress.completed;
  if (!raw || typeof raw !== 'object') return new Set();
  return new Set(Object.keys(raw).filter((k) => raw[k]));
}

export const isLessonDone = (progress, lessonId) => completedSet(progress).has(lessonId);

// The one to offer: the first lesson, in course order, that is not done yet.
// Null when everything is done — the map then says so instead of pointing at a
// lesson that is already ticked.
export function nextLesson(progress) {
  const done = completedSet(progress);
  return allLessons.find((l) => !done.has(l.id)) || null;
}

// The lesson after this one, so the reader can hand straight over at the end.
// It walks the flat list, which means it crosses into the next module rather
// than stopping at a module boundary.
export function lessonAfter(lessonId) {
  const i = allLessons.findIndex((l) => l.id === lessonId);
  if (i < 0 || i + 1 >= allLessons.length) return null;
  return allLessons[i + 1];
}

// The lesson to offer from inside the activity a module was written for: the
// first unread one of that module, or its opener once they are all read (a
// contextual link has to lead somewhere, even to a re-read).
export function nextInModule(moduleId, progress) {
  const mod = lessonModules.find((m) => m.id === moduleId);
  if (!mod || !mod.lessons.length) return null;
  const done = completedSet(progress);
  return mod.lessons.find((l) => !done.has(l.id)) || mod.lessons[0];
}

export function moduleProgress(moduleId, progress) {
  const mod = lessonModules.find((m) => m.id === moduleId);
  if (!mod) return { done: 0, total: 0, complete: false };
  const done = completedSet(progress);
  const count = mod.lessons.filter((l) => done.has(l.id)).length;
  return { done: count, total: mod.lessons.length, complete: count === mod.lessons.length };
}

// Percent is rounded but never allowed to reach 100 before the last lesson is
// actually done — "100%" with a lesson still open would be a lie about the
// learner's own record.
export function overallProgress(progress) {
  const done = completedSet(progress);
  const count = allLessons.filter((l) => done.has(l.id)).length;
  const raw = lessonCount ? (count / lessonCount) * 100 : 0;
  const percent = count >= lessonCount ? 100 : Math.min(99, Math.round(raw));
  return { done: count, total: lessonCount, percent };
}

// Minutes of reading left, for the "about 12 minutes to go" line. An unknown or
// missing `minutes` counts as 3 rather than 0, so the estimate errs long.
export function minutesLeft(progress) {
  const done = completedSet(progress);
  return allLessons
    .filter((l) => !done.has(l.id))
    .reduce((sum, l) => sum + (Number(l.minutes) > 0 ? Number(l.minutes) : 3), 0);
}

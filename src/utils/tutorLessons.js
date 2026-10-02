// Individual lessons (Preply / Google Meet). Each lesson is its own doc with
// its own date (tutorLessons/{id}, written by the teacherLesson function); the
// learner's enrolment — level, package, platform — is tutorStudents/{uid}.
// Pure helpers for the Today card, the lesson page and the teacher's panel.

const HOUR_MS = 60 * 60 * 1000;

export const atMs = (l) => (l?.at && typeof l.at.toMillis === 'function' ? l.at.toMillis() : Number(l?.at) || 0);

export const byDate = (a, b) => atMs(a) - atMs(b);

// The lesson to prepare for: the first one not held or cancelled whose start
// is not more than two hours gone — a lesson in progress is still "next", and
// its topic stays the same all day.
export function nextLesson(lessons = [], nowMs = Date.now()) {
  return [...lessons].sort(byDate)
    .find((l) => l.status === 'planned' && atMs(l) > nowMs - 2 * HOUR_MS) || null;
}

// Lessons held so far against the package. Cancelled lessons never count.
export function packageSummary(enrolment, lessons = []) {
  const held = lessons.filter((l) => l.status === 'held').length;
  const size = Number(enrolment?.packageSize) || 0;
  const planned = lessons.filter((l) => l.status === 'planned').length;
  return { held, size, planned, left: Math.max(0, size - held) };
}

// The lesson's number — also the story episode read before it. A held lesson
// keeps the number the server gave it (held lessons numbered by date); a
// planned one counts every lesson before it that was not cancelled, so the
// lessons planned ahead get 3, 4, 5 … rather than all "the next one".
export function episodeFor(lesson, lessons = []) {
  if (!lesson) return null;
  if (lesson.status === 'held' && Number.isInteger(lesson.n)) return lesson.n;
  return lessons.filter((l) => l.id !== lesson.id && l.status !== 'cancelled' && atMs(l) < atMs(lesson)).length + 1;
}

// The steps of a lesson's homework, in order. "Your mistakes" exists only when
// the learner's own reports gave it something (homeworkBuilder.js on the
// server). The story is read BEFORE the lesson, so it is not homework. The
// server mirrors this in functions/classBrief.js — change both.
export function homeworkStepKeys(personal) {
  const p = personal || {};
  const mine = ['words', 'themes', 'multipleChoice', 'wordOrder']
    .some((k) => Array.isArray(p[k]) && p[k].length > 0);
  return ['words', 'dictation', ...(mine ? ['mine'] : []), 'speak'];
}

// "Tue 7 Oct, 19:00" in the viewer's own time zone (a learner abroad sees
// their clock; the teacher in Baku sees Baku).
export function lessonWhen(ms, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(ms));
}

export const PLATFORM_LABEL = { preply: 'Preply', meet: 'Google Meet' };

// The planned lessons still ahead (or in progress), as schedule items next to
// practice bookings: `startMs` like a booking, `kind: 'lesson'` to tell them
// apart, and the lesson's number (= the story episode read before it).
export function lessonItems(lessons = [], nowMs = Date.now()) {
  const sorted = [...lessons].sort(byDate);
  return sorted
    .filter((l) => l.status === 'planned' && atMs(l) > nowMs - 2 * HOUR_MS)
    .map((l) => ({ ...l, kind: 'lesson', startMs: atMs(l), number: episodeFor(l, sorted) }));
}

// Bookings and lessons in one time line, nearest first.
export function mergeSchedule(bookings = [], items = []) {
  return [...bookings, ...items].sort((a, b) => Number(a.startMs) - Number(b.startMs));
}

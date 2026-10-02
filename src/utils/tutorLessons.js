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

// The story episode a lesson goes with: a held lesson keeps its number (the
// server numbers held lessons by date); a planned one is the next after the
// lessons held before it.
export function episodeFor(lesson, lessons = []) {
  if (!lesson) return null;
  if (lesson.status === 'held' && Number.isInteger(lesson.n)) return lesson.n;
  return lessons.filter((l) => l.status === 'held' && atMs(l) < atMs(lesson)).length + 1;
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

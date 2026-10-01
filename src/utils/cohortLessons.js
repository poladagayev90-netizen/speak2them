import { bakuDateStr, bakuWeekday, getActiveDays } from './sessionSchedule';

// A cohort is a teacher's class: a fixed number of lessons on fixed weekdays
// at one Baku time, from a start date. Lesson DATES are never stored — they
// follow from these four fields, so moving the class (new start date, other
// days) moves every lesson at once. What IS stored per lesson
// (cohorts/{id}/lessons/{n}) is what the teacher decided: the topic and
// whether it was held.
//
//   cohort.lessonCount  number of lessons bought, e.g. 12
//   cohort.lessonDays   Baku weekdays, 0 = Sunday … 6 = Saturday
//   cohort.lessonMin    lesson start, minutes after Baku midnight
//   cohort.startDate    'YYYY-MM-DD', the first day a lesson may fall on

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_LESSONS = 60;

const pad = (n) => String(n).padStart(2, '0');

// True when the cohort has a class schedule (old cohorts only have a start
// tick and keep the Topic X/60 card).
export function isClassCohort(cohort) {
  return !!cohort
    && Number(cohort.lessonCount) > 0
    && Array.isArray(cohort.lessonDays) && cohort.lessonDays.length > 0
    && Number.isFinite(Number(cohort.lessonMin))
    && /^\d{4}-\d{2}-\d{2}$/.test(cohort.startDate || '');
}

// Every lesson of the class with its Baku start time, in order.
export function lessonDates(cohort) {
  if (!isClassCohort(cohort)) return [];
  const days = new Set(cohort.lessonDays.map(Number));
  const total = Math.min(MAX_LESSONS, Number(cohort.lessonCount));
  const min = Number(cohort.lessonMin);
  const out = [];
  let ms = Date.parse(`${cohort.startDate}T12:00:00+04:00`);
  // A week has at least one lesson day, so total * 7 days always suffices.
  for (let i = 0; out.length < total && i <= total * 7; i++, ms += DAY_MS) {
    const dateStr = bakuDateStr(ms);
    if (!days.has(bakuWeekday(dateStr))) continue;
    const startMs = Date.parse(`${dateStr}T${pad(Math.floor(min / 60))}:${pad(min % 60)}:00+04:00`);
    out.push({ n: out.length + 1, dateStr, startMs });
  }
  return out;
}

// What the student and the teacher need at a glance. `lessons` are the stored
// lesson docs ({n, status, topicIndex}); a lesson counts as done only when the
// teacher marked it held — the calendar alone never says it happened.
export function lessonSummary(cohort, lessons = [], nowMs = Date.now()) {
  const dates = lessonDates(cohort);
  if (dates.length === 0) return null;
  const byN = new Map(lessons.map((l) => [Number(l.n), l]));
  const merged = dates.map((d) => ({ ...d, ...(byN.get(d.n) || {}), n: d.n }));
  const held = merged.filter((l) => l.status === 'held').length;
  // The next lesson is the first one not held whose start is not more than two
  // hours gone (a lesson in progress is still "next").
  const next = merged.find((l) => l.status !== 'held' && l.startMs > nowMs - 2 * 60 * 60 * 1000) || null;
  const last = dates[dates.length - 1];
  return {
    total: dates.length,
    held,
    lessons: merged,
    next,
    ended: nowMs > last.startMs + 2 * 60 * 60 * 1000,
  };
}

// The general course for learners outside a cohort: how many topics the shared
// daily cycle has moved through since they joined. The cycle advances once on
// each main day (sessionDays + bonusDays), so this counts those days from the
// day after the trial started. Display only — nothing is granted by it.
export function topicsSinceJoin(user, sessionConfig, total, nowMs = Date.now()) {
  const started = user?.trialStartedAt;
  const startMs = typeof started?.toMillis === 'function' ? started.toMillis()
    : (typeof started === 'number' ? started : null);
  if (!startMs || startMs > nowMs) return null;
  const days = getActiveDays(sessionConfig);
  if (days.size === 0) return null;
  let count = 0;
  for (let ms = startMs + DAY_MS; ms <= nowMs && count < total; ms += DAY_MS) {
    if (days.has(bakuWeekday(bakuDateStr(ms)))) count += 1;
  }
  return count;
}

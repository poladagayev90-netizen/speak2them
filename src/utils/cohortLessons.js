import { bakuDateStr, bakuWeekday, getActiveDays } from './sessionSchedule';

const DAY_MS = 24 * 60 * 60 * 1000;

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

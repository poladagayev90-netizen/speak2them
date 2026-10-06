// The learner's own week, for the Plan tab calendar and Today's check-in card.
// Pure (tests in myWeek.test.js). Mirrors functions/autoRoster.js — keep the
// «who is in» rules the same on both sides.
//
// The learner answers per week: the days they want to practise
// (onboarding.weeks.{monday} = { days, at }) or «not this week» ({ skip }).
// Days are weekdays in the learner's OWN clock (0 = Sunday), the same as
// their saved free times.

import { rangesToCells } from './timezone';

const DAY_MS = 24 * 60 * 60 * 1000;
const BAKU_MS = 4 * 60 * 60 * 1000;
export const NEW_GRACE_MS = 2 * DAY_MS;

export const addDaysKey = (key, n) => new Date(Date.parse(`${key}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const bakuWeekKey = (ms) => {
  const d = new Date(ms + BAKU_MS);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

// Mon…Sun of the week starting `monday`.
export function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(monday, i);
    const d = new Date(`${date}T12:00:00`);
    return {
      date,
      wd: d.getDay(),
      dow: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      num: d.getDate(),
    };
  });
}

export const freeWeekdays = (availability) => new Set((availability || []).map((r) => r.day));

// The hours picked for one week (Plan tab grid, 2026-10-07):
// { "3": [20, 21], "5": [19] } — weekday → whole hours in the learner's own
// clock. Anything malformed is dropped; null when nothing is left.
export function parseHours(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, list] of Object.entries(raw)) {
    const wd = Number(k);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6 || !Array.isArray(list)) continue;
    const hs = [...new Set(list.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
    if (hs.length) out[wd] = hs;
  }
  return Object.keys(out).length ? out : null;
}

export function weekAnswer(onboarding, monday) {
  const w = onboarding && onboarding.weeks && onboarding.weeks[monday];
  if (!w || typeof w !== 'object') return null;
  if (w.skip === true) return { in: false };
  const hours = parseHours(w.hours);
  if (hours) return { in: true, days: Object.keys(hours).map(Number), hours };
  return { in: true, days: Array.isArray(w.days) ? w.days.filter((x) => Number.isInteger(x)) : [] };
}

// Grid cells ("wd-h") <-> the stored { wd: [h] } map.
export function cellsToHours(cells) {
  const out = {};
  for (const key of cells || []) {
    const [wd, h] = key.split('-').map(Number);
    (out[wd] = out[wd] || []).push(h);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
  return out;
}
const hoursToCells = (hours) => new Set(Object.entries(hours || {}).flatMap(([wd, hs]) => hs.map((h) => `${wd}-${h}`)));

// The hours shown for a week: what they picked, else their usual hours on
// the days they picked (an answer from before the grid), else their usual
// hours on the suggested days.
export function weekCells({ monday, onboarding, now = Date.now() }) {
  const answer = weekAnswer(onboarding, monday);
  if (answer && answer.in && answer.hours) return hoursToCells(answer.hours);
  const usual = rangesToCells((onboarding && onboarding.availability) || []);
  const days = answer ? (answer.in ? answer.days : []) : suggestDays({ monday, onboarding, now });
  if (answer && answer.in && !days.length) return usual;
  return new Set([...usual].filter((k) => days.includes(Number(k.split('-')[0]))));
}

// Can a practice still start at this hour of that date (30 min ahead)?
export const hourAhead = (date, h, now = Date.now()) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime() >= now + 30 * 60000;

// Planned practices: one a day, at most this many a week (the planner's cap).
export const MAX_A_WEEK = 4;

// Local "YYYY-MM-DD" of a moment, on this device.
const localKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// What the calendar shows for each day of the week.
//   state: past | booked | offered | picked | free | none
//   `cells` (grid hours, "wd-h") — a day counts as picked when one of its
//   hours is still ahead; without cells, `picked` days are used as before.
export function calendarDays({ monday, onboarding, bookings = [], offers = [], picked = null, cells = null, now = Date.now() }) {
  const today = localKey(now);
  const free = freeWeekdays(onboarding && onboarding.availability);
  const usual = rangesToCells((onboarding && onboarding.availability) || []);
  const chosen = new Set(picked || []);
  const hoursOf = (set, wd) => [...set].filter((k) => Number(k.split('-')[0]) === wd).map((k) => Number(k.split('-')[1]));
  return weekDays(monday).map((d) => {
    const booking = bookings.find((b) => b.status === 'confirmed' && localKey(Number(b.startMs)) === d.date);
    const offer = offers.find((o) => localKey(Number(o.startMs)) === d.date && Number(o.startMs) > now);
    let state;
    if (booking) state = 'booked';
    else if (offer) state = 'offered';
    else if (d.date < today) state = 'past';
    else if (cells) {
      const mine = hoursOf(cells, d.wd).filter((h) => hourAhead(d.date, h, now)).sort((x, y) => x - y);
      const left = hoursOf(usual, d.wd).some((h) => hourAhead(d.date, h, now));
      state = mine.length ? 'picked' : left ? 'free' : 'none';
      return { ...d, state, hours: mine, booking: null, offer: null, isToday: d.date === today };
    } else if (!free.has(d.wd)) state = 'none';
    else state = chosen.has(d.wd) ? 'picked' : 'free';
    return { ...d, state, booking: booking || null, offer: offer || null, isToday: d.date === today };
  });
}

// Days to suggest when the learner has not answered: their free days still
// ahead, as many as their usual number, spread across the week.
export function suggestDays({ monday, onboarding, now = Date.now() }) {
  const today = localKey(now);
  const free = freeWeekdays(onboarding && onboarding.availability);
  const ahead = weekDays(monday).filter((d) => d.date >= today && free.has(d.wd)).map((d) => d.wd);
  const want = Math.max(1, Math.min(4, Number(onboarding && onboarding.weeklyTarget) || 1));
  if (ahead.length <= want) return ahead;
  const out = [];
  for (let i = 0; i < want; i += 1) out.push(ahead[Math.floor((i * ahead.length) / want)]);
  return [...new Set(out)];
}

// Is this learner in for the week starting `monday` without answering?
// (A package, or they joined that week / the weekend before.)
export function autoIn({ onboarding, access, monday }) {
  if (access && (access.kind === 'package' || access.kind === 'unlimited')) return true;
  const joined = Number(onboarding && onboarding.charterAcceptedAt && (onboarding.charterAcceptedAt.toMillis
    ? onboarding.charterAcceptedAt.toMillis() : onboarding.charterAcceptedAt.seconds * 1000)) || 0;
  const weekStart = Date.parse(`${monday}T00:00:00+04:00`);
  return joined >= weekStart - NEW_GRACE_MS;
}

// Today's question, when the autopilot needs one: on Saturday/Sunday about
// next week, on a weekday about this week (someone back after a while, or who
// did not answer at the weekend). null = nothing to ask.
export function checkinFor({ onboarding, access, auto = null, now = Date.now() }) {
  if (!onboarding || onboarding.planPaused === true) return null;
  if (!freeWeekdays(onboarding.availability).size) return null;
  const wd = new Date(now + BAKU_MS).getUTCDay();
  const thisWeek = bakuWeekKey(now);
  const weekend = wd === 6 || wd === 0;
  const monday = weekend ? addDaysKey(thisWeek, 7) : thisWeek;
  if (weekAnswer(onboarding, monday)) return null;
  if (autoIn({ onboarding, access, monday })) return null;
  // The server already counts them in for this week (a regular, say).
  if (auto && auto.week === monday && auto.in) return null;
  // Friday evening or later in the week, a «this week» question is too late.
  if (!weekend && wd === 5 && new Date(now + BAKU_MS).getUTCHours() >= 18) return null;
  const days = suggestDays({ monday, onboarding, now });
  if (!days.length) return null;
  return { monday, next: weekend, days };
}

export const dayNames = (days) => {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  return order.filter((d) => (days || []).includes(d)).map((d) => names[d]).join(', ');
};

// Popular times (appConfig/popularTimes, written by the server on Sunday:
// how many learners are free per Baku block "weekday-hour"), turned into the
// learner's own clock. `offsetMin` = their zone minus Baku (offsetVsBaku).
// Returns the busiest blocks first, evenings winning a tie.
export function popularBlocks(cells, offsetMin = 0) {
  const out = [];
  for (const [k, n] of Object.entries(cells || {})) {
    const [wd, hour] = k.split('-').map(Number);
    if (!Number.isInteger(wd) || !Number.isInteger(hour)) continue;
    const week = 7 * 1440;
    const own = ((wd * 1440 + hour * 60 + offsetMin) % week + week) % week;
    out.push({ key: k, count: n, day: Math.floor(own / 1440), startMin: own % 1440, evening: hour >= 18 });
  }
  return out.sort((a, b) => b.count - a.count || Number(b.evening) - Number(a.evening) || a.day - b.day || a.startMin - b.startMin);
}

const covered = (availability, day, startMin, endMin) => (availability || [])
  .some((r) => r.day === day && r.startMin <= startMin && r.endMin >= endMin);

// The one popular block to offer someone nobody fits: the busiest block they
// are not already free at. null when there is none.
export function popularSuggestion(cells, availability, offsetMin = 0) {
  const best = popularBlocks(cells, offsetMin).find((b) => !covered(availability, b.day, b.startMin, b.startMin + 60));
  if (!best) return null;
  const names = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return {
    day: best.day, startMin: best.startMin, endMin: Math.min(1440, best.startMin + 120), count: best.count,
    label: `${names[best.day]} ${hh(best.startMin)}`,
  };
}

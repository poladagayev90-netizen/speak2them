import { isAdminUser } from '../constants';
import { cellsToRanges, rangesToCells, tzOffsetMinutes, WEEK_DAYS } from './timezone';

// The general week profile (Faza 3, 2026-10-07): the onboarding grid paints
// three kinds of hour, in the learner's OWN time.
//   free  — onboarding.availability (unchanged shape; the planner's base)
//   maybe — onboarding.maybeAvailability: used only when it wins a practice
//   never — onboarding.busyAvailability: never planned, not even if picked
//           for one week on the Plan grid (functions/weeklyPlanner.js)
// One state per cell — painting a cell takes it out of the other two.
export const PROFILE_MODES = [
  { id: 'free', label: 'Free', hint: 'Usually free' },
  { id: 'maybe', label: 'Maybe', hint: 'If nothing else fits' },
  { id: 'never', label: 'Never', hint: 'Classes, work' },
];

export function profileCells(onboarding) {
  const ob = onboarding || {};
  return {
    free: rangesToCells(ob.availability || []),
    maybe: rangesToCells(ob.maybeAvailability || []),
    never: rangesToCells(ob.busyAvailability || []),
  };
}

// A tap in `mode`: the cell becomes that kind, or plain again if it already was.
export function paintCell(cells, key, mode) {
  const had = cells[mode].has(key);
  const next = { free: new Set(cells.free), maybe: new Set(cells.maybe), never: new Set(cells.never) };
  for (const k of Object.keys(next)) next[k].delete(key);
  if (!had) next[mode].add(key);
  return next;
}

export const cellKind = (cells, key) => (cells.free.has(key) ? 'free' : cells.maybe.has(key) ? 'maybe' : cells.never.has(key) ? 'never' : null);

// Active learners who answered before the profile existed get one Today card
// asking for it (newcomers fill it in the wizard). Teachers and the admin are
// not planned, so they are not asked.
export function needsWeekProfile(user, onboarding) {
  if (!user || !onboarding || user.role === 'teacher' || isAdminUser(user)) return false;
  if (onboarding.weekProfileAt) return false;
  return Number(user.callCount) > 0;
}

// A Baku slot id ("2026-10-07-20") → where it falls in the learner's own
// week: { day (0 = Sunday), hour }.
export function ownTimeOfSlot(slotId, timeZone = 'Asia/Baku') {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(String(slotId || ''));
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}:00:00+04:00`);
  const own = new Date(ms + tzOffsetMinutes(timeZone || 'Asia/Baku', new Date(ms)) * 60000);
  return { day: own.getUTCDay(), hour: own.getUTCHours() };
}

export const dayHourLabel = ({ day, hour }) =>
  `${(WEEK_DAYS.find((d) => d.day === day) || {}).short || ''} ${String(hour).padStart(2, '0')}:00`;

// «Mark Tue 20:00 as Never» after a miss: the new ranges for the onboarding
// doc. The free list keeps the hour when it is the only one left — the rules
// require at least one free range, and the planner refuses a Never hour anyway.
export function markNever(onboarding, { day, hour }) {
  const key = `${day}-${hour}`;
  const cells = profileCells(onboarding);
  const next = paintCell({ ...cells, never: new Set([...cells.never].filter((k) => k !== key)) }, key, 'never');
  const free = next.free.size ? next.free : cells.free;
  return {
    availability: cellsToRanges(free),
    maybeAvailability: cellsToRanges(next.maybe),
    busyAvailability: cellsToRanges(next.never),
  };
}

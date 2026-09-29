// Server copy of the availability maths in src/utils/timezone.js — the
// weekly planner runs here, so it cannot import the client module. Keep the
// two in step; availability.test.js pins the same cases.
//
// Availability is stored in the learner's OWN time plus their IANA zone. It is
// converted to Baku with the offset of the week being planned, not of today:
// a Berlin learner's "18:00" is 20:00 Baku in summer and 21:00 in winter.
//
// Intervals are "week minutes": 0 = Sunday 00:00, 10080 = next Sunday.

const BAKU_TZ = 'Asia/Baku';
const WEEK_MIN = 7 * 24 * 60;

function tzOffsetMinutes(tz, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(date);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  } catch {
    return 240; // unknown zone → treat as Baku, same fallback as the client
  }
}

const offsetVsBaku = (tz, date = new Date()) => tzOffsetMinutes(tz, date) - tzOffsetMinutes(BAKU_TZ, date);

function mergeIntervals(list) {
  const sorted = [...list].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function toWeekIntervals(availability = [], shiftMin = 0) {
  const out = [];
  for (const r of availability || []) {
    if (!r || !Number.isFinite(r.day) || !Number.isFinite(r.startMin) || !Number.isFinite(r.endMin)) continue;
    const raw = r.day * 1440 + r.startMin + shiftMin;
    const a = ((raw % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
    const b = a + (r.endMin - r.startMin);
    if (b <= WEEK_MIN) out.push([a, b]);
    else { out.push([a, WEEK_MIN]); out.push([0, b - WEEK_MIN]); }
  }
  return mergeIntervals(out);
}

// `date` = a moment inside the week being planned (its offset is used).
const toBakuIntervals = (availability, tz, date = new Date()) =>
  toWeekIntervals(availability, -offsetVsBaku(tz || BAKU_TZ, date));

function intersectIntervals(a, b) {
  const out = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i += 1; else j += 1;
  }
  return out;
}

// Free for the whole window [a, b] (week minutes)? A window that runs past
// Saturday midnight wraps to Sunday.
function covers(intervals, a, b) {
  if (b <= WEEK_MIN) return intervals.some(([lo, hi]) => lo <= a && hi >= b);
  return covers(intervals, a, WEEK_MIN) && covers(intervals, 0, b - WEEK_MIN);
}

module.exports = { BAKU_TZ, WEEK_MIN, tzOffsetMinutes, offsetVsBaku, mergeIntervals, toWeekIntervals, toBakuIntervals, intersectIntervals, covers };

// Time-zone helpers for availability.
//
// Availability is STORED in the learner's own local time plus their IANA zone
// (onboarding/{uid}.timeZone), never pre-converted to Baku. Conversion happens
// at display time with the offset of *today*, so a zone that observes DST is
// still right next season — a Baku copy frozen at signup would silently drift
// by an hour.
//
// Intervals below are "week minutes": 0 = Sunday 00:00, 10080 = next Sunday.
// Sunday is 0 to match the rest of the app (sessionSchedule, practiceSlots).

export const BAKU_TZ = 'Asia/Baku';
export const WEEK_MIN = 7 * 24 * 60;

// Display order is Monday-first (how people in AZ/TR read a week); the stored
// `day` value stays 0=Sunday.
export const WEEK_DAYS = [
  { day: 1, short: 'Mon' }, { day: 2, short: 'Tue' }, { day: 3, short: 'Wed' },
  { day: 4, short: 'Thu' }, { day: 5, short: 'Fri' }, { day: 6, short: 'Sat' },
  { day: 0, short: 'Sun' },
];

// Minutes east of UTC for `tz` at `date`. Intl has no direct offset API, so we
// read the wall-clock parts in that zone and diff them against UTC.
export function tzOffsetMinutes(tz, date = new Date()) {
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
    return 240; // unknown zone → treat as Baku, same fallback as pushText.js
  }
}

// How far `tz` is from Baku, in minutes. Istanbul → -60.
export function offsetVsBaku(tz, date = new Date()) {
  return tzOffsetMinutes(tz, date) - tzOffsetMinutes(BAKU_TZ, date);
}

export function formatOffsetVsBaku(tz) {
  const d = offsetVsBaku(tz);
  if (d === 0) return 'same as Baku';
  const h = Math.abs(d) / 60;
  const txt = Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  return `Baku ${d > 0 ? '+' : '−'}${txt}`;
}

export function formatLocalNow(tz) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date());
  } catch {
    return '—';
  }
}

// "Europe/Istanbul" → "Istanbul"
export function cityOf(tz) {
  if (!tz) return '';
  return tz.split('/').pop().replace(/_/g, ' ');
}

export function formatMinutes(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- intervals --

export function mergeIntervals(list) {
  const sorted = [...list].filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// Stored ranges → week-minute intervals, shifted by `shiftMin` (e.g. into Baku
// time) and wrapped so Saturday 23:00 local can become Sunday 00:00 Baku.
export function toWeekIntervals(availability = [], shiftMin = 0) {
  const out = [];
  for (const r of availability) {
    const raw = r.day * 1440 + r.startMin + shiftMin;
    const a = ((raw % WEEK_MIN) + WEEK_MIN) % WEEK_MIN;
    const b = a + (r.endMin - r.startMin);
    if (b <= WEEK_MIN) out.push([a, b]);
    else { out.push([a, WEEK_MIN]); out.push([0, b - WEEK_MIN]); }
  }
  return mergeIntervals(out);
}

// Availability expressed in Baku week-minutes — the common clock the admin
// compares people on.
export function toBakuIntervals(availability, tz) {
  return toWeekIntervals(availability, -offsetVsBaku(tz || BAKU_TZ));
}

export function intersectIntervals(a, b) {
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

// Overlap of several people's week intervals.
export function overlapAll(lists) {
  if (!lists.length) return [];
  return lists.slice(1).reduce((acc, l) => intersectIntervals(acc, l), lists[0]);
}

// Week intervals → per-day display rows: [{ day, startMin, endMin }], cut at
// midnight so each row belongs to exactly one day.
export function intervalsByDay(intervals) {
  const rows = [];
  for (const [a, b] of intervals) {
    let s = a;
    while (s < b) {
      const day = Math.floor(s / 1440);
      const dayEnd = (day + 1) * 1440;
      const e = Math.min(b, dayEnd);
      rows.push({ day: day % 7, startMin: s - day * 1440, endMin: e - day * 1440 });
      s = e;
    }
  }
  return rows;
}

// ----------------------------------------------------------- grid <-> ranges --
// The onboarding grid works in whole-hour cells keyed "day-hour". Ranges are
// what gets stored, so consecutive hours on one day collapse into one range.

export function cellsToRanges(cells) {
  const byDay = new Map();
  for (const key of cells) {
    const [d, h] = key.split('-').map(Number);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(h);
  }
  const out = [];
  for (const [day, hours] of byDay) {
    hours.sort((x, y) => x - y);
    let start = hours[0]; let prev = hours[0];
    for (let i = 1; i <= hours.length; i += 1) {
      const h = hours[i];
      if (h === prev + 1) { prev = h; continue; }
      out.push({ day, startMin: start * 60, endMin: (prev + 1) * 60 });
      start = h; prev = h;
    }
  }
  return out.sort((x, y) => x.day - y.day || x.startMin - y.startMin);
}

export function rangesToCells(ranges = []) {
  const cells = new Set();
  for (const r of ranges) {
    for (let m = r.startMin; m < r.endMin; m += 60) cells.add(`${r.day}-${Math.floor(m / 60)}`);
  }
  return cells;
}

export function totalHours(ranges = []) {
  return ranges.reduce((s, r) => s + (r.endMin - r.startMin), 0) / 60;
}

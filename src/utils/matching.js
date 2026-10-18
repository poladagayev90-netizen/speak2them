// Admin → Matching: the arithmetic behind the matching desk, kept pure so it
// can be tested. Everything is in Baku time — the practice blocks are Baku
// blocks (practiceSlots.js) and availability is converted with
// toBakuIntervals before it reaches here.

import { SLOT_BLOCK_HOURS, SLOT_START_HOURS, slotIdOf, slotStartMs, SLOT_BLOCK_MS } from './practiceSlots';
import { LEVELS } from './onboarding';
import { toBakuIntervals } from './timezone';
import { weekAnswer } from './myWeek';

const DAY_MS = 24 * 60 * 60 * 1000;
// adminProposeMatch refuses blocks further than this (BOOKING_HORIZON_DAYS).
export const PROPOSE_HORIZON_DAYS = 9;
// An offer needs time to be answered.
export const PROPOSE_LEAD_MS = 30 * 60 * 1000;
// A block "fits" someone when at least this much of its two hours is free.
export const FIT_MIN = 60;
// A START fits when both are free this long from it — the weekly planner's
// rule (PLAN_MIN_OVERLAP_MIN): a practice is 20–30 minutes.
export const START_FIT_MIN = 30;

export const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

// Every practice block of the Baku week that starts on `monday`, with whether
// a proposal can still be sent for it.
export function weekBlocks(monday, nowMs = Date.now()) {
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(monday, i);
    for (const hour of SLOT_BLOCK_HOURS) {
      const startMs = slotStartMs(date, hour);
      out.push({
        slotId: slotIdOf(date, hour), date, hour, day: weekdayOf(date), startMs,
        bookable: startMs > nowMs + PROPOSE_LEAD_MS && startMs <= nowMs + PROPOSE_HORIZON_DAYS * DAY_MS,
      });
    }
  }
  return out;
}

// Every whole-hour START of the week (07:00–23:00) — what the admin can
// propose or move a practice to since 2026-10-07. The 2-hour weekBlocks above
// stay the overview grid.
export function weekStarts(monday, nowMs = Date.now()) {
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(monday, i);
    for (const hour of SLOT_START_HOURS) {
      const startMs = slotStartMs(date, hour);
      out.push({
        slotId: slotIdOf(date, hour), date, hour, day: weekdayOf(date), startMs,
        bookable: startMs > nowMs + PROPOSE_LEAD_MS && startMs <= nowMs + PROPOSE_HORIZON_DAYS * DAY_MS,
      });
    }
  }
  return out;
}

// Free minutes in a row from a start (at most the two-hour window).
export function startFitMin(bakuIntervals, block) {
  let t = block.day * 1440 + block.hour * 60;
  const end = t + 120;
  for (let moved = true; moved && t < end;) {
    moved = false;
    for (const [x, y] of bakuIntervals || []) {
      if (x <= t && y > t) { t = Math.min(end, y); moved = true; }
    }
  }
  return t - (block.day * 1440 + block.hour * 60);
}

// People in a practice whose window overlaps one starting at `startMs`.
export function busyAround(pairs, startMs) {
  const s = new Set();
  for (const p of pairs) {
    if (Math.abs(Number(p.startMs) - Number(startMs)) < SLOT_BLOCK_MS) { s.add(p.a); s.add(p.b); }
  }
  return s;
}

// Minutes of a block that fall inside free time (Baku week minutes, Sunday 0).
export function blockFitMin(bakuIntervals, block) {
  const a = block.day * 1440 + block.hour * 60;
  const b = a + 120;
  let sum = 0;
  for (const [x, y] of bakuIntervals || []) sum += Math.max(0, Math.min(b, y) - Math.max(a, x));
  return sum;
}
export const fitsBlock = (bakuIntervals, block) => blockFitMin(bakuIntervals, block) >= FIT_MIN;

// The week's pairs as they really stand: open proposals and booked practices.
// A confirmed proposal is already a booking, so it is not listed twice; closed
// proposals (declined, withdrawn, expired) are history, not pairs.
export function weekPairs(offers = [], bookings = []) {
  const pairs = [];
  const bookedKeys = new Set();
  for (const b of bookings) {
    if (b.status !== 'confirmed' && b.status !== 'done') continue;
    const [a, c] = b.participants || [];
    if (!a || !c) continue;
    bookedKeys.add(`${b.slotId}|${[a, c].sort().join('|')}`);
    pairs.push({
      key: `b:${b.id}`, kind: b.status === 'done' ? 'held' : 'booked',
      slotId: b.slotId, startMs: b.startMs, a, b: c,
      nameA: b.names?.[a] || '', nameB: b.names?.[c] || '',
      levelA: b.levels?.[a] || null, levelB: b.levels?.[c] || null,
      bookingId: b.id, accepted: { [a]: true, [c]: true },
    });
  }
  for (const o of offers) {
    if (o.status !== 'pending') continue;
    if (bookedKeys.has(`${o.slotId}|${[o.userA, o.userB].sort().join('|')}`)) continue;
    pairs.push({
      key: `o:${o.id}`, kind: 'pending',
      slotId: o.slotId, startMs: o.startMs, a: o.userA, b: o.userB,
      nameA: o.nameA || '', nameB: o.nameB || '', levelA: o.levelA || null, levelB: o.levelB || null,
      offerId: o.id, source: o.source || 'admin',
      accepted: { [o.userA]: o.responses?.[o.userA] === 'accepted', [o.userB]: o.responses?.[o.userB] === 'accepted' },
    });
  }
  return pairs.sort((x, y) => x.startMs - y.startMs);
}

// Proposals that closed without a booking (no answer in time, declined, could
// not be booked) and are still worth sending again: neither person has
// anything else in that block now. One row per pair and block — the newest.
export function closedOffers(offers = [], pairs = []) {
  const busy = new Set();
  for (const p of pairs) { busy.add(`${p.slotId}|${p.a}`); busy.add(`${p.slotId}|${p.b}`); }
  const seen = new Map();
  for (const o of offers) {
    if (!['expired', 'declined', 'failed'].includes(o.status)) continue;
    if (busy.has(`${o.slotId}|${o.userA}`) || busy.has(`${o.slotId}|${o.userB}`)) continue;
    const key = `${o.slotId}|${[o.userA, o.userB].sort().join('|')}`;
    const prev = seen.get(key);
    const t = (x) => (x?.closedAt?.toMillis ? x.closedAt.toMillis() : Number(x?.closedAtMs) || 0);
    if (!prev || t(o) >= t(prev)) seen.set(key, o);
  }
  return [...seen.values()].map((o) => ({
    key: `c:${o.id}`, kind: o.status, slotId: o.slotId, startMs: o.startMs, a: o.userA, b: o.userB,
    nameA: o.nameA || '', nameB: o.nameB || '', levelA: o.levelA || null, levelB: o.levelB || null,
    offerId: o.id, source: o.source || 'admin', accepted: {},
  })).sort((x, y) => x.startMs - y.startMs);
}

// How many of the week's pairs someone is in (open + booked + held).
export function plannedCount(pairs, uid) {
  return pairs.filter((p) => p.a === uid || p.b === uid).length;
}
// Everyone already in a pair in that block.
export function busyInBlock(pairs, slotId) {
  const s = new Set();
  for (const p of pairs) if (p.slotId === slotId) { s.add(p.a); s.add(p.b); }
  return s;
}

const levelIndex = (lv) => {
  const s = String(lv || '').slice(0, 2).toUpperCase();
  const i = LEVELS.findIndex((l) => l.short === s);
  return i < 0 ? null : i;
};
export function levelGap(x, y) {
  const a = levelIndex(x);
  const b = levelIndex(y);
  return a === null || b === null ? null : Math.abs(a - b);
}

// Who could take `keepId`'s practice in `block` instead of their partner —
// best first: free then, close in level, furthest below their weekly target.
// People free that hour come first; the rest follow when `all` is set, so the
// admin can still choose someone who has not filled in their times.
export function candidatesFor({ keepId, block, people, pairs, all = false }) {
  const keep = people.find((p) => p.id === keepId);
  // Busy = in any practice whose window overlaps this one (hourly starts).
  const busy = Number.isFinite(block.startMs) ? busyAround(pairs, block.startMs) : busyInBlock(pairs, block.slotId);
  return people
    .filter((p) => p.id !== keepId && !busy.has(p.id))
    .map((p) => {
      const fit = startFitMin(p.baku, block);
      const gap = keep ? levelGap(keep.level, p.level) : null;
      const planned = plannedCount(pairs, p.id);
      return { ...p, fit, gap, planned, short: Math.max(0, (p.wants || 0) - planned) };
    })
    .filter((p) => all || p.fit >= START_FIT_MIN)
    .sort((x, y) => (y.fit >= START_FIT_MIN) - (x.fit >= START_FIT_MIN)
      || (y.inList - x.inList)
      || ((x.gap ?? 9) - (y.gap ?? 9))
      || (y.short - x.short)
      || x.name.localeCompare(y.name));
}

// ── Free-time grid and People console (2026-10-18) ─────────────────
// The grid used to be 7×8 two-hour blocks lit at ≥ 60 free minutes, so a
// learner free 19–22 showed 18 and 20 — not what Applicants showed, and not
// what the planner uses. Now it is hourly starts (SLOT_START_HOURS) lit at
// START_FIT_MIN from the start, like the pickers, over the week the planner
// really sees: picked hours for that week (onboarding.weeks.{monday}), else
// the usual times on the picked days, else the usual times — minus «Never».
// Mirrors functions/autoRoster.js weekAvailability / weekMaybe.

// [[a, b]] minus [[c, d]] (sorted, merged week-minute intervals).
export function subtractIntervals(list, cut) {
  let out = (list || []).map(([a, b]) => [a, b]);
  for (const [c, d] of cut || []) {
    const next = [];
    for (const [a, b] of out) {
      if (d <= a || c >= b) { next.push([a, b]); continue; }
      if (c > a) next.push([a, c]);
      if (d < b) next.push([d, b]);
    }
    out = next;
  }
  return out;
}

function hoursToRanges(hours) {
  const out = [];
  for (const [wd, hs] of Object.entries(hours || {})) {
    let start = hs[0];
    for (let i = 1; i <= hs.length; i += 1) {
      if (hs[i] === hs[i - 1] + 1) continue;
      out.push({ day: Number(wd), startMin: start * 60, endMin: (hs[i - 1] + 1) * 60 });
      start = hs[i];
    }
  }
  return out;
}

// Someone's ranges for one week, in their own clock.
export function weekRanges(onboarding, monday) {
  const ob = onboarding || {};
  const answer = weekAnswer(ob, monday);
  const usual = Array.isArray(ob.availability) ? ob.availability : [];
  const maybeAll = Array.isArray(ob.maybeAvailability) ? ob.maybeAvailability : [];
  const never = Array.isArray(ob.busyAvailability) ? ob.busyAvailability : [];
  const days = answer && answer.in && answer.days && answer.days.length ? new Set(answer.days) : null;
  let week = usual;
  let maybe = maybeAll;
  if (answer && !answer.in) { week = []; maybe = []; }
  else if (answer && answer.hours) { week = hoursToRanges(answer.hours); maybe = []; }
  else if (days) { week = usual.filter((r) => days.has(r.day)); maybe = maybeAll.filter((r) => days.has(r.day)); }
  return { answer, picked: !!(answer && answer.in && (answer.hours || days)), skip: !!(answer && !answer.in), usual, week, maybe, never };
}

// Rows Mon→Sun × SLOT_START_HOURS. A cell's `state`: 'pair' (a practice of
// theirs starts then), 'picked' (free that week by their own pick), 'free'
// (free by their usual times), 'off' (usually free, not this week), ''.
// `maybe`: a «Maybe» hour (drawn as an outline).
export function freeGrid({ onboarding, monday, uid, pairs = [] }) {
  const ob = onboarding || {};
  const tz = ob.timeZone;
  const r = weekRanges(ob, monday);
  const nev = toBakuIntervals(r.never, tz);
  const usualB = subtractIntervals(toBakuIntervals(r.usual, tz), nev);
  const weekB = subtractIntervals(toBakuIntervals(r.week, tz), nev);
  const maybeB = subtractIntervals(toBakuIntervals(r.maybe, tz), nev);
  const mine = new Map();
  for (const p of pairs) if (p.a === uid || p.b === uid) mine.set(p.slotId, p.kind);
  let free = 0;
  const rows = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(monday, i);
    const day = weekdayOf(date);
    const cells = SLOT_START_HOURS.map((hour) => {
      const blk = { day, hour };
      const slotId = slotIdOf(date, hour);
      let state = '';
      if (mine.has(slotId)) state = 'pair';
      else if (startFitMin(weekB, blk) >= START_FIT_MIN) state = r.picked ? 'picked' : 'free';
      else if (startFitMin(usualB, blk) >= START_FIT_MIN) state = 'off';
      const maybe = !state && startFitMin(maybeB, blk) >= START_FIT_MIN;
      return { slotId, date, hour, state, maybe, kind: mine.get(slotId) || null };
    });
    free += cells.filter((c) => c.state === 'picked' || c.state === 'free').length;
    rows.push({ date, day, cells });
  }
  return { rows, free, picked: r.picked, skip: r.skip, practices: mine.size };
}

// What the «Needs attention» box counts. `p`: inWeek, planned, calls,
// joinedMs, paid, why (autopilot verdict), health (accountHealth cls),
// reliability (level), whatsapp.
export const ATTENTION = [
  ['noPlan', 'In this week, nothing planned'],
  ['newNoFirst', 'New, no first practice'],
  ['paidAsleep', 'Paid but snoozed or asleep'],
  ['limited', 'Reliability limited'],
  ['noWhatsApp', 'No WhatsApp'],
];
const NEW_WINDOW_MS = 14 * DAY_MS;
export function attentionOf(p, nowMs = Date.now()) {
  const asleep = ['snoozed', 'asleep'].includes(p.why) || ['sleeping', 'ghost'].includes(p.health);
  return {
    noPlan: !!p.inWeek && !p.planned,
    newNoFirst: !(Number(p.calls) > 0) && (p.joinedMs || 0) > nowMs - NEW_WINDOW_MS,
    paidAsleep: !!p.paid && asleep,
    limited: p.reliability === 'limited',
    noWhatsApp: !String(p.whatsapp || '').trim(),
  };
}

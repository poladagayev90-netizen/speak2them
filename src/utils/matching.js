// Admin → Matching: the arithmetic behind the matching desk, kept pure so it
// can be tested. Everything is in Baku time — the practice blocks are Baku
// blocks (practiceSlots.js) and availability is converted with
// toBakuIntervals before it reaches here.

import { SLOT_BLOCK_HOURS, slotIdOf, slotStartMs } from './practiceSlots';
import { LEVELS } from './onboarding';

const DAY_MS = 24 * 60 * 60 * 1000;
// adminProposeMatch refuses blocks further than this (BOOKING_HORIZON_DAYS).
export const PROPOSE_HORIZON_DAYS = 9;
// An offer needs time to be answered.
export const PROPOSE_LEAD_MS = 30 * 60 * 1000;
// A block "fits" someone when at least this much of its two hours is free.
export const FIT_MIN = 60;

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
  const busy = busyInBlock(pairs, block.slotId);
  return people
    .filter((p) => p.id !== keepId && !busy.has(p.id))
    .map((p) => {
      const fit = blockFitMin(p.baku, block);
      const gap = keep ? levelGap(keep.level, p.level) : null;
      const planned = plannedCount(pairs, p.id);
      return { ...p, fit, gap, planned, short: Math.max(0, (p.wants || 0) - planned) };
    })
    .filter((p) => all || p.fit >= FIT_MIN)
    .sort((x, y) => (y.fit >= FIT_MIN) - (x.fit >= FIT_MIN)
      || (y.inList - x.inList)
      || ((x.gap ?? 9) - (y.gap ?? 9))
      || (y.short - x.short)
      || x.name.localeCompare(y.name));
}

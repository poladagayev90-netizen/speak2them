// The weekly planner: who practises with whom, when, next week.
//
// Pure — no Firestore. index.js loads the inputs (onboarding availability,
// weekly targets, blocks, existing bookings) and writes the result; this file
// only decides. That split is what lets the rules below be pinned by tests.
//
// HARD rules (a plan never breaks them):
//   • pairVerdict's rules: no block / "don't pair me again" either way, no
//     minor with an adult, no CEFR gap > 1 when either chose a close level;
//   • each person gets at most what they asked for (weeklyTarget, minus what
//     they already have booked or offered that week);
//   • at most one practice per person per day;
//   • the same two people at most once a week;
//   • both are free from the block's start for PLAN_MIN_OVERLAP_MIN minutes
//     (a practice is 20–30 minutes — asking for an hour of shared free time
//     threw away pairs that fit perfectly well);
//   • nothing earlier than `earliestMs` (people need notice).
// SOFT preferences (the score): same level, someone not met this week,
// practices spread out over the week, the evening hours most people use.
//
// Fairness beats totals: the objective weights each person's n-th practice
// by 1/n, so everyone gets one before anyone gets a third.

const { toBakuIntervals, covers } = require('./availability');

const BLOCK_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const PLAN_MIN_OVERLAP_MIN = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const pad2 = (n) => String(n).padStart(2, '0');
const slotIdOf = (date, hour) => `${date}-${pad2(hour)}`;
const blockStartMs = (date, hour) => Date.parse(`${date}T${pad2(hour)}:00:00+04:00`);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const levelRank = (level) => {
  const m = /^(A1|A2|B1|B2|C1|C2)\b/.exec(String(level || ''));
  return m ? LEVELS.indexOf(m[1]) : null;
};

// Monday date string → the seven Baku dates Mon..Sun.
function weekDates(monday) {
  const base = Date.parse(`${monday}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => new Date(base + i * DAY_MS).toISOString().slice(0, 10));
}
// Day of week of a Baku date, 0 = Sunday (the app's convention).
const weekdayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const dateShift = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// The blocks of `dates` a learner is free for, as slot ids.
function freeSlots({ availability, timeZone }, dates, earliestMs, minOverlap = PLAN_MIN_OVERLAP_MIN) {
  if (!dates.length) return [];
  // The offset of the planned week (mid-week), so a DST change is respected.
  const mid = new Date(blockStartMs(dates[Math.min(3, dates.length - 1)], 12));
  const intervals = toBakuIntervals(availability || [], timeZone, mid);
  const out = [];
  for (const date of dates) {
    const wd = weekdayOf(date);
    for (const hour of BLOCK_HOURS) {
      if (blockStartMs(date, hour) < earliestMs) continue;
      const a = wd * 1440 + hour * 60;
      if (covers(intervals, a, a + minOverlap)) out.push(slotIdOf(date, hour));
    }
  }
  return out;
}

// May these two be paired at all? (pairVerdict's hard rules, as data.)
function pairAllowed(a, b, blocked) {
  if (a.uid === b.uid) return false;
  if (blocked.has(pairKey(a.uid, b.uid))) return false;
  if (!!a.minor !== !!b.minor) return false;
  // Reliability (Phase 5): someone who keeps missing confirmed practices is
  // never a newcomer's first experience of the app.
  if ((a.limited && b.newcomer) || (b.limited && a.newcomer)) return false;
  if (a.partnerLevel === 'close' || b.partnerLevel === 'close') {
    const ra = levelRank(a.level); const rb = levelRank(b.level);
    if (ra !== null && rb !== null && Math.abs(ra - rb) > 1) return false;
  }
  return true;
}

function levelScore(a, b) {
  const ra = levelRank(a.level); const rb = levelRank(b.level);
  if (ra === null || rb === null) return { score: 0, reason: 'level unknown' };
  const gap = Math.abs(ra - rb);
  if (gap === 0) return { score: 3, reason: 'same level' };
  if (gap === 1) return { score: 1, reason: 'one level apart' };
  return { score: -2, reason: `${gap} levels apart` };
}
const HOUR_BONUS = { 20: 0.5, 18: 0.25, 22: 0.25 };

// Deterministic randomness: the same week and inputs give the same plan.
function rngFrom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let s = h >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const harmonic = (n) => { let x = 0; for (let i = 1; i <= n; i++) x += 1 / i; return x; };

// learners: [{ uid, name, level, minor, partnerLevel, availability, timeZone,
//              need, busyDates: [date], pairedWith: [uid], priority }]
//   need       — how many more practices this week (target minus what exists)
//   busyDates  — days that already hold a booking or a pending offer
//   pairedWith — partners already booked/offered this week (no repeat)
//   priority   — > 0 for someone the platform let down this week (refill)
//   limited    — reliability limit (reliability.js); never paired with…
//   newcomer   — …someone who has not had a practice call yet
// blocked: Set of pairKey — block/avoid either way
// recent:  Set of pairKey — met in the last 7 days (soft)
function buildWeekPlan({ learners, blocked = new Set(), recent = new Set(), dates, earliestMs = 0, seed = 'plan', restarts }) {
  const people = learners.map((l) => ({
    ...l,
    need: Math.max(0, Math.floor(Number(l.need) || 0)),
    free: new Set(freeSlots(l, dates, earliestMs)),
    busy: new Set(l.busyDates || []),
    paired: new Set(l.pairedWith || []),
    priority: Number(l.priority) || 0,
  }));
  const byUid = new Map(people.map((p) => [p.uid, p]));

  // Every allowed pair and the blocks both are free for — computed once.
  const pairs = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i]; const b = people[j];
      if (!a.need || !b.need) continue;
      if (a.paired.has(b.uid) || b.paired.has(a.uid)) continue;
      if (!pairAllowed(a, b, blocked)) continue;
      const shared = [...a.free].filter((s) => b.free.has(s)).sort();
      if (!shared.length) continue;
      const sharedDates = shared.map((s) => s.slice(0, 10));
      const lvl = levelScore(a, b);
      const isRecent = recent.has(pairKey(a.uid, b.uid));
      pairs.push({ a: a.uid, b: b.uid, key: pairKey(a.uid, b.uid), shared, sharedDates, lvl, isRecent });
    }
  }
  const pairsOf = new Map();
  for (const pr of pairs) {
    for (const uid of [pr.a, pr.b]) {
      if (!pairsOf.has(uid)) pairsOf.set(uid, []);
      pairsOf.get(uid).push(pr);
    }
  }

  const scoreOf = (pr, slotId, state) => {
    const date = slotId.slice(0, 10);
    const hour = Number(slotId.slice(11));
    let s = pr.lvl.score + (pr.isRecent ? -3 : 0) + (HOUR_BONUS[hour] || 0);
    for (const uid of [pr.a, pr.b]) {
      const days = state.days.get(uid);
      if (days.has(dateShift(date, -1)) || days.has(dateShift(date, 1))) s -= 1;
    }
    return s;
  };

  const runOnce = (rand, noise) => {
    const state = {
      left: new Map(people.map((p) => [p.uid, p.need])),
      got: new Map(people.map((p) => [p.uid, 0])),
      days: new Map(people.map((p) => [p.uid, new Set(p.busy)])),
      used: new Set(),
      plan: [],
    };
    const live = (pr) => state.left.get(pr.a) > 0 && state.left.get(pr.b) > 0 && !state.used.has(pr.key);
    const openSlots = (pr) => {
      const da = state.days.get(pr.a); const db = state.days.get(pr.b);
      return pr.shared.filter((s, i) => !da.has(pr.sharedDates[i]) && !db.has(pr.sharedDates[i]));
    };
    for (;;) {
      // How many options each person still has — counted, not collected: this
      // loop runs for every step of every restart.
      const count = new Map();
      for (const pr of pairs) {
        if (!live(pr)) continue;
        const da = state.days.get(pr.a); const db = state.days.get(pr.b);
        let n = 0;
        for (const d of pr.sharedDates) if (!da.has(d) && !db.has(d)) n += 1;
        if (!n) continue;
        count.set(pr.a, (count.get(pr.a) || 0) + n);
        count.set(pr.b, (count.get(pr.b) || 0) + n);
      }
      if (!count.size) break;
      // The most constrained person goes first; ties: who the platform owes,
      // then chance (varies between restarts).
      let pick = null;
      for (const [uid, n] of count) {
        const p = byUid.get(uid);
        const rank = [n, -p.priority, rand()];
        if (!pick || rank[0] < pick.rank[0] || (rank[0] === pick.rank[0] && (rank[1] < pick.rank[1]
          || (rank[1] === pick.rank[1] && rank[2] < pick.rank[2])))) pick = { uid, rank };
      }
      const mine = [];
      for (const pr of pairsOf.get(pick.uid) || []) {
        if (!live(pr)) continue;
        for (const slotId of openSlots(pr)) mine.push({ pr, slotId });
      }
      let best = null;
      for (const opt of mine) {
        const other = opt.pr.a === pick.uid ? opt.pr.b : opt.pr.a;
        // Among equals, a partner who has had fewer practices goes first.
        const s = scoreOf(opt.pr, opt.slotId, state) - 0.3 * state.got.get(other) + noise * rand();
        if (!best || s > best.s || (s === best.s && opt.slotId < best.opt.slotId)) best = { s, opt };
      }
      const { pr, slotId } = best.opt;
      const date = slotId.slice(0, 10);
      const score = scoreOf(pr, slotId, state);
      for (const uid of [pr.a, pr.b]) {
        state.left.set(uid, state.left.get(uid) - 1);
        state.got.set(uid, state.got.get(uid) + 1);
        state.days.get(uid).add(date);
      }
      state.used.add(pr.key);
      state.plan.push({ a: pr.a, b: pr.b, slotId, score, pr });
    }
    let value = 0;
    for (const p of people) value += (1 + p.priority) * harmonic(state.got.get(p.uid));
    value += 0.01 * state.plan.reduce((sum, x) => sum + x.score, 0);
    return { value, state };
  };

  const n = people.length;
  const tries = restarts ?? (n <= 30 ? 20 : n <= 60 ? 8 : 3);
  const rand = rngFrom(seed);
  let best = runOnce(rand, 0);
  for (let i = 1; i < tries; i++) {
    const r = runOnce(rand, 1.5);
    if (r.value > best.value + 1e-9) best = r;
  }

  const { state } = best;
  const out = state.plan
    .sort((x, y) => (x.slotId < y.slotId ? -1 : x.slotId > y.slotId ? 1 : 0))
    .map(({ a, b, slotId, score, pr }) => {
      const date = slotId.slice(0, 10);
      // Where else this pair could go without breaking anyone's day.
      const alternatives = pr.shared.filter((s) => {
        const d = s.slice(0, 10);
        if (s === slotId) return false;
        if (d === date) return true;
        return !state.days.get(a).has(d) && !state.days.get(b).has(d);
      }).slice(0, 4);
      return {
        id: pairKey(a, b).replace('|', '_'),
        a, b, slotId,
        startMs: blockStartMs(date, Number(slotId.slice(11))),
        score: Math.round(score * 100) / 100,
        reasons: [pr.lvl.reason, pr.isRecent ? 'met in the last 7 days' : 'not met this week'],
        alternatives,
      };
    });

  const unmet = [];
  for (const p of people) {
    const got = state.got.get(p.uid);
    if (got >= p.need) continue;
    let reason = 'no_partner_left';
    if (!p.free.size) reason = 'no_times';
    else if (!pairs.some((pr) => pr.a === p.uid || pr.b === p.uid)) reason = 'no_overlap';
    unmet.push({ uid: p.uid, wanted: p.need, got, reason });
  }

  const demand = people.reduce((s, p) => s + p.need, 0);
  return {
    pairs: out,
    unmet,
    stats: { learners: n, demand, planned: out.length * 2, pairs: out.length, restarts: tries },
  };
}

module.exports = {
  BLOCK_HOURS, PLAN_MIN_OVERLAP_MIN,
  weekDates, weekdayOf, freeSlots, pairAllowed, pairKey, blockStartMs, slotIdOf, buildWeekPlan,
};

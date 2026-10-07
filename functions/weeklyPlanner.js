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
//   • both are free from the start for PLAN_MIN_OVERLAP_MIN minutes
//     (a practice is 20–30 minutes — asking for an hour of shared free time
//     threw away pairs that fit perfectly well);
//   • nothing earlier than `earliestMs` (people need notice).
// SOFT preferences (the score): a partner either of them starred ("practise
// with them again" — both starring counts double, and a starred pair is not
// marked down for having met recently), same level, someone not met this week,
// practices spread out over the week, the evening hours most people use.
//
// The general week profile (2026-10-07): besides «Free», a learner may mark
// hours «Maybe» and «Never». Maybe hours are candidates with a penalty per
// side, so they are used only when they win someone a practice; Never hours
// are refused outright, even inside the week's picked hours. An hour the
// learner later called «the wrong time for me» (missReasons) is marked down
// the same way.
//
// Fairness beats totals: the objective weights each person's n-th practice
// by 1/n, so everyone gets one before anyone gets a third.

const { toBakuIntervals, covers, touches, mergeIntervals } = require('./availability');

// A practice may start at any whole hour 07:00–23:00 (2026-10-07 — someone
// free only 11:00–12:00 could never be planned on the old 2-hour grid). One a
// day per person still holds, so two planned practices never overlap.
const BLOCK_HOURS = Array.from({ length: 17 }, (_, i) => 7 + i);
// The 2-hour grid that is left: popular times (appConfig/popularTimes) and the
// admin's week overview count people per block of it.
const GRID_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
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
const dateShiftRaw = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
// Memoised: the score asks for a day's neighbours for every option of every
// step of every restart, and with hourly starts there are twice the options.
const shiftMemo = new Map();
const dateShift = (date, days) => {
  const k = `${date}|${days}`;
  let v = shiftMemo.get(k);
  if (v === undefined) { v = dateShiftRaw(date, days); if (shiftMemo.size > 5000) shiftMemo.clear(); shiftMemo.set(k, v); }
  return v;
};

const MAYBE_PENALTY = 1;
const WRONG_TIME_PENALTY = 1.5;

// The starts of `dates` a learner could take, as slot ids: free (or maybe)
// from the start for `minOverlap` minutes, touching no «Never» hour.
//   maybe — the ones that need a «Maybe» hour (a penalty in the score)
//   avoid — the ones at a weekday + Baku hour they called the wrong time
// wrongTimes: ["<weekday>-<baku hour>"] (functions/index.js reads missReasons).
function slotOptions({ availability, maybeAvailability, busyAvailability, wrongTimes, timeZone }, dates, earliestMs, minOverlap = PLAN_MIN_OVERLAP_MIN) {
  const res = { slots: [], maybe: new Set(), avoid: new Set() };
  if (!dates.length) return res;
  // The offset of the planned week (mid-week), so a DST change is respected.
  const mid = new Date(blockStartMs(dates[Math.min(3, dates.length - 1)], 12));
  const free = toBakuIntervals(availability || [], timeZone, mid);
  const maybe = toBakuIntervals(maybeAvailability || [], timeZone, mid);
  const either = maybe.length ? mergeIntervals([...free, ...maybe]) : free;
  const never = toBakuIntervals(busyAvailability || [], timeZone, mid);
  const wrong = new Set(wrongTimes || []);
  for (const date of dates) {
    const wd = weekdayOf(date);
    for (const hour of BLOCK_HOURS) {
      if (blockStartMs(date, hour) < earliestMs) continue;
      const a = wd * 1440 + hour * 60;
      if (!covers(either, a, a + minOverlap)) continue;
      if (never.length && touches(never, a, a + minOverlap)) continue;
      const slotId = slotIdOf(date, hour);
      res.slots.push(slotId);
      if (!covers(free, a, a + minOverlap)) res.maybe.add(slotId);
      if (wrong.has(`${wd}-${hour}`)) res.avoid.add(slotId);
    }
  }
  return res;
}

// The blocks of `dates` a learner is free for, as slot ids.
const freeSlots = (learner, dates, earliestMs, minOverlap = PLAN_MIN_OVERLAP_MIN) =>
  slotOptions(learner, dates, earliestMs, minOverlap).slots;

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
// The evening hours most people use; 20:00 is the app's recommended hour.
const HOUR_BONUS = { 19: 0.3, 20: 0.5, 21: 0.4, 18: 0.25, 22: 0.2 };

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
// favorites: Map of pairKey → how many of the two starred the other (1 or 2)
const FAVORITE_BONUS = 2;
function buildWeekPlan({ learners, blocked = new Set(), recent = new Set(), favorites = new Map(), dates, earliestMs = 0, seed = 'plan', restarts }) {
  const people = learners.map((l) => {
    const opt = slotOptions(l, dates, earliestMs);
    return {
      ...l,
      need: Math.max(0, Math.floor(Number(l.need) || 0)),
      free: new Set(opt.slots),
      maybe: opt.maybe,
      avoid: opt.avoid,
      busy: new Set(l.busyDates || []),
      paired: new Set(l.pairedWith || []),
      priority: Number(l.priority) || 0,
    };
  });
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
      // Options are counted per DAY: with hourly starts, a pair free all
      // evening would otherwise look four times as flexible as one free for
      // an hour, and "most constrained first" would stop meaning anything.
      const days = [...new Set(sharedDates)];
      const lvl = levelScore(a, b);
      const fav = Math.min(2, Number(favorites.get(pairKey(a.uid, b.uid))) || 0);
      const isRecent = !fav && recent.has(pairKey(a.uid, b.uid));
      pairs.push({ i: pairs.length, a: a.uid, b: b.uid, key: pairKey(a.uid, b.uid), shared, sharedDates, days, lvl, isRecent, fav });
    }
  }
  const pairsOf = new Map();
  for (const pr of pairs) {
    for (const uid of [pr.a, pr.b]) {
      if (!pairsOf.has(uid)) pairsOf.set(uid, []);
      pairsOf.get(uid).push(pr);
    }
  }

  // Each planned day's neighbours, looked up once: the score asks for them
  // for every option of every step of every restart.
  const nearDays = new Map(dates.map((d) => [d, [dateShift(d, -1), dateShift(d, 1)]]));
  const scoreOf = (pr, slotId, state) => {
    const date = slotId.slice(0, 10);
    const hour = Number(slotId.slice(11));
    let s = pr.lvl.score + (pr.isRecent ? -3 : 0) + pr.fav * FAVORITE_BONUS + (HOUR_BONUS[hour] || 0);
    const [before, after] = nearDays.get(date);
    for (const uid of [pr.a, pr.b]) {
      const days = state.days.get(uid);
      if (days.has(before) || days.has(after)) s -= 1;
      const p = byUid.get(uid);
      if (p.maybe.size && p.maybe.has(slotId)) s -= MAYBE_PENALTY;
      if (p.avoid.size && p.avoid.has(slotId)) s -= WRONG_TIME_PENALTY;
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
    // How many open DAYS each pair still has (0 once it is used, either side
    // is full, or every shared day is taken) and each person's total.
    // Kept up to date instead of recounted every step: a step only changes
    // the two people it books, so only their pairs are looked at again. The
    // full recount made the planner grow with the CUBE of the crowd — 600
    // learners took 50 s, past a scheduled function's 60 s limit with the
    // refill's restarts (load test 2026-10-08). The result is the same plan:
    // a pair's count only ever goes down, and people are visited in the
    // order the old recount met them (the first pair still open, `a` before
    // `b`), so `rand()` is drawn in the same order too.
    const openDays = (pr) => {
      if (!live(pr)) return 0;
      const da = state.days.get(pr.a); const db = state.days.get(pr.b);
      let n = 0;
      for (const d of pr.days) if (!da.has(d) && !db.has(d)) n += 1;
      return n;
    };
    const open = new Array(pairs.length);
    const total = new Map(people.map((p) => [p.uid, 0]));
    for (const pr of pairs) {
      const n = openDays(pr);
      open[pr.i] = n;
      if (n) { total.set(pr.a, total.get(pr.a) + n); total.set(pr.b, total.get(pr.b) + n); }
    }
    const firstAt = new Map(); // uid → index into pairsOf(uid) of the first open pair
    const orderKey = (uid) => {
      const list = pairsOf.get(uid);
      let j = firstAt.get(uid) || 0;
      while (!open[list[j].i]) j += 1;
      firstAt.set(uid, j);
      return list[j].i * 2 + (list[j].a === uid ? 0 : 1);
    };
    for (;;) {
      const waiting = [];
      for (const [uid, n] of total) if (n > 0) waiting.push([orderKey(uid), uid, n]);
      if (!waiting.length) break;
      waiting.sort((x, y) => x[0] - y[0]);
      // The most constrained person goes first; ties: who the platform owes,
      // then chance (varies between restarts).
      let pick = null;
      for (const [, uid, n] of waiting) {
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
      for (const q of [...pairsOf.get(pr.a), ...pairsOf.get(pr.b)]) {
        if (!open[q.i]) continue; // closed for good (also skips the shared pair's second visit)
        const n = openDays(q);
        const d = n - open[q.i];
        if (!d) continue;
        open[q.i] = n;
        total.set(q.a, total.get(q.a) + d);
        total.set(q.b, total.get(q.b) + d);
      }
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
        reasons: [
          ...(pr.fav ? [pr.fav === 2 ? 'both want to practise again' : 'asked to practise again'] : []),
          pr.lvl.reason, pr.isRecent ? 'met in the last 7 days' : 'not met this week',
          ...[a, b].filter((u) => byUid.get(u).maybe.has(slotId)).map(() => 'a «maybe» time'),
        ],
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
  BLOCK_HOURS, GRID_HOURS, PLAN_MIN_OVERLAP_MIN, MAYBE_PENALTY, WRONG_TIME_PENALTY,
  weekDates, weekdayOf, freeSlots, slotOptions, pairAllowed, pairKey, blockStartMs, slotIdOf, buildWeekPlan,
};

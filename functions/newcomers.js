// ── A newcomer's first practice ──
// (2026-10-15, the funnel before the ad test.) Of 14 learners who joined
// from 2026-09-28, one reached a practice. Eight never opened the app again
// after signing up, nine could get no push at all, and the refill paired
// newcomers with other newcomers or with accounts that had left on day one —
// one newcomer said yes to a partner who was long gone. Only about three
// older learners answered proposals at all.
//
// So a newcomer is now:
//   • «in» for planning right after the wizard (finishing it IS the yes —
//     directBook can book them before they close the app), unless they
//     answer the week themselves;
//   • paired only with someone who will show up: an older learner who has
//     practised or said yes lately and can be reached by push, or another
//     newcomer who was in the app in the last two days;
//   • booked with a host (appConfig/planner.newcomerHosts — the team or a
//     learner who agreed to it) when no such partner fits in the next 72 h.
//
// Pure: index.js reads the docs and passes plain values.

const weeklyPlanner = require('./weeklyPlanner');
const { parseHours } = require('./autoRoster');

const DAY_MS = 24 * 60 * 60 * 1000;
// Finishing the wizard counts as «in» this long — long enough to reach the
// Sunday send when someone joins on a Friday.
const NEW_COMMIT_MS = 3 * DAY_MS;
// Two newcomers are paired only when both were in the app this recently.
const FRESH_MS = 2 * DAY_MS;
// An older learner is a newcomer's partner only after a practice or a yes
// this recently.
const RESPONSIVE_MS = 14 * DAY_MS;
// A host is booked for a start within this long from now.
const HOST_WINDOW_MS = 72 * 60 * 60 * 1000;
const MAX_HOSTS = 5;

// Their own answer for the week wins; with none, a newcomer who finished the
// wizard in the last three days is «in».
function committedFor({ answer, calls, joinedAtMs, nowMs }) {
  if (answer) return !!answer.in;
  if (Number(calls) > 0) return false;
  const joined = Number(joinedAtMs) || 0;
  return joined > 0 && nowMs - joined <= NEW_COMMIT_MS;
}

const fresh = (lastSeenMs, nowMs) => nowMs - (Number(lastSeenMs) || 0) <= FRESH_MS;

// An older learner a newcomer can count on: reachable by push, and has
// practised or said yes to a proposal in the last two weeks.
function responsive({ calls, hasPush, lastPracticeMs, lastYesMs, nowMs }) {
  if (!(Number(calls) > 0) || !hasPush) return false;
  const since = nowMs - RESPONSIVE_MS;
  return (Number(lastPracticeMs) || 0) >= since || (Number(lastYesMs) || 0) >= since;
}

// May this person be a newcomer's partner? (weeklyPlanner.pairAllowed reads it
// as the learner's `newcomerOk`.) A newcomer: only while fresh — that also
// keeps two newcomers apart unless BOTH were in the app lately.
function newcomerOk(person, nowMs) {
  const p = person || {};
  if (!(Number(p.calls) > 0)) return fresh(p.lastSeenMs, nowMs);
  return responsive({ ...p, nowMs });
}

// appConfig/planner.newcomerHosts → [{ uid, hours }]. An entry is a uid (their
// own onboarding times are used) or { uid, hours: { "<weekday>": [Baku hour] } }
// for someone with no onboarding grid (the admin).
function parseHosts(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const e of raw) {
    const uid = typeof e === 'string' ? e : (e && typeof e.uid === 'string' ? e.uid : '');
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid, hours: typeof e === 'object' ? parseHours(e.hours) : null });
    if (out.length >= MAX_HOSTS) break;
  }
  return out;
}

// { "<weekday>": [Baku hour] } → availability ranges in Baku time.
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
  return out.sort((a, b) => a.day - b.day || a.startMin - b.startMin);
}

// Newcomers still without a practice → a host each, at the earliest start
// both are free for in [earliestMs, earliestMs-window end]. A host takes at
// most one newcomer a day and none on a day they already practise; the hard
// pairing rules (block, minor ↔ adult) still hold.
//   newcomers: learner objects (weeklyPlanner shape) + joinedAtMs; the ones
//              waiting longest go first
//   hosts:     learner objects (weeklyPlanner shape) + busyDates
// → [{ a: newcomerUid, b: hostUid, slotId, startMs }]
function hostPairs({ newcomers, hosts, dates, earliestMs, latestMs, blocked = new Set() }) {
  if (!newcomers.length || !hosts.length || !dates.length) return [];
  const hostState = hosts.map((h) => ({
    h, busy: new Set(h.busyDates || []),
    free: new Set(weeklyPlanner.freeSlots(h, dates, earliestMs)),
  }));
  const order = [...newcomers].sort((x, y) => (x.joinedAtMs || 0) - (y.joinedAtMs || 0) || (x.uid < y.uid ? -1 : 1));
  const out = [];
  for (const n of order) {
    const busy = new Set(n.busyDates || []);
    const mine = weeklyPlanner.freeSlots(n, dates, earliestMs)
      .filter((s) => weeklyPlanner.blockStartMs(s.slice(0, 10), Number(s.slice(11))) <= latestMs)
      .sort();
    let best = null;
    for (const slotId of mine) {
      const date = slotId.slice(0, 10);
      if (busy.has(date)) continue;
      // Never the host's own student (Polad 2026-10-15: his Preply students
      // practise with others, not with him through the app).
      const host = hostState.find((hs) => hs.free.has(slotId) && !hs.busy.has(date)
        && n.teacherId !== hs.h.uid && weeklyPlanner.pairAllowed(n, hs.h, blocked));
      if (host) { best = { slotId, host }; break; }
    }
    if (!best) continue;
    best.host.busy.add(best.slotId.slice(0, 10));
    out.push({
      a: n.uid, b: best.host.h.uid, slotId: best.slotId,
      startMs: weeklyPlanner.blockStartMs(best.slotId.slice(0, 10), Number(best.slotId.slice(11))),
    });
  }
  return out;
}

module.exports = {
  NEW_COMMIT_MS, FRESH_MS, RESPONSIVE_MS, HOST_WINDOW_MS, MAX_HOSTS,
  committedFor, fresh, responsive, newcomerOk, parseHosts, hoursToRanges, hostPairs,
};

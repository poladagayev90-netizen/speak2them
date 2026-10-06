// ── Autopilot: who is planned in a week without the admin ticking names ──
// (Polad 2026-10-06: "matching must run fully on its own; the admin may step
// in"). The admin's weekly list kept dead and fake accounts out, but nobody
// new got in without him. What tells a real learner from a dead account best
// is the learner saying so: «I'm in this week» (Plan tab calendar, the
// weekend check-in, the welcome-back card, finishing the wizard). A package
// learner who is still opening the app is in without being asked — they paid.
//
// Silence is never punished: someone who did not answer is simply not
// planned that week, and one tap brings them back.
//
// Pure: index.js reads the docs and passes plain values.

const DAY_MS = 24 * 60 * 60 * 1000;
const ASLEEP_AFTER_MS = 7 * DAY_MS;
// Signing up (finishing the wizard) late in a week, or at the weekend for the
// next one, counts as «in» — nobody waits a week for their first practice.
const NEW_GRACE_MS = 2 * DAY_MS;
// This many plan/refill proposals in a row left unanswered → snoozed until
// they say «in» again (or answer a proposal). Not a penalty — no limit, no
// mark; they just stop getting proposals they never read. Only proposals
// that gave a real day to answer count: missing a short one is not silence.
const SNOOZE_AFTER_UNANSWERED = 2;
const FAIR_WINDOW_MS = 12 * 60 * 60 * 1000;
// Said yes to a proposal in the last three weeks = a real, active learner:
// planned without being asked every week (the simulation 2026-10-06 showed
// the weekly question alone left a third of real learners out).
const PROVEN_WINDOW_MS = 21 * DAY_MS;

const msOf = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return 0;
};

// The learner's own answer for the week starting `monday` (Plan tab calendar /
// check-in): { in: true, days: [weekday…] } | { in: false } | null.
function weekAnswer(onboarding, monday) {
  const w = onboarding && onboarding.weeks && onboarding.weeks[monday];
  if (!w || typeof w !== 'object') return null;
  if (w.skip === true) return { in: false, atMs: msOf(w.at) };
  const hours = parseHours(w.hours);
  if (hours) return { in: true, days: Object.keys(hours).map(Number), hours, atMs: msOf(w.at) };
  const days = Array.isArray(w.days) ? [...new Set(w.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  return { in: true, days, atMs: msOf(w.at) };
}

// The hours picked for that week in the Plan tab grid (2026-10-07):
// { "3": [20, 21] } = weekday → whole hours, the learner's own clock. The
// rules cannot check the shape (no loops), so anything odd is dropped here.
// Mirrored in src/utils/myWeek.js parseHours.
function parseHours(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, list] of Object.entries(raw)) {
    const wd = Number(k);
    if (!Number.isInteger(wd) || wd < 0 || wd > 6 || !Array.isArray(list)) continue;
    const hs = [...new Set(list.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
    if (hs.length) out[wd] = hs.slice(0, 24);
  }
  return Object.keys(out).length ? out : null;
}

// Proposals the person left to run out, newest last. `offers`: their plan /
// refill offers as { startMs, status, response } (response = their own).
// Counts the unanswered ones at the END of the list, after their last sign of
// life (an answer to any proposal, or a week answer at `answeredAtMs`).
function unansweredStreak(offers, answeredAtMs = 0) {
  const list = [...(offers || [])].sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  let n = 0;
  for (const o of list) {
    if (o.response === 'accepted' || o.response === 'declined') { n = 0; continue; }
    // Old offers carry no sentAtMs: only plan offers (48 h) count then.
    const fair = o.windowMs != null ? o.windowMs >= FAIR_WINDOW_MS : o.source === 'weekly_plan';
    if (fair && o.status === 'expired' && (o.closedAtMs || o.startMs || 0) > answeredAtMs) n += 1;
  }
  return n;
}

// Said yes to any proposal that started in the last three weeks.
function provenRecently(offers, nowMs) {
  return (offers || []).some((o) => o.response === 'accepted' && (o.startMs || 0) >= nowMs - PROVEN_WINDOW_MS);
}

// { in, why }. `person`:
//   uid, lastSeenMs, joinedAtMs (charter accepted), hasTimes, charter, paused,
//   paid (package or unlimited), practicesLeft (false only when the switch is
//   on and nothing is left), answer (weekAnswer), unanswered (streak),
//   excluded / included (the admin's override for the week).
function eligible(person, { weekStartMs, nowMs }) {
  const p = person || {};
  if (p.excluded) return { in: false, why: 'excluded' };
  if (!p.hasTimes || !p.charter) return { in: false, why: 'not_set_up' };
  if (p.included) return { in: true, why: 'included' };
  if (p.paused) return { in: false, why: 'paused' };
  if (!(nowMs - (p.lastSeenMs || 0) <= ASLEEP_AFTER_MS)) return { in: false, why: 'asleep' };
  if (p.practicesLeft === false) return { in: false, why: 'no_practices_left' };
  if (p.answer && p.answer.in === false) return { in: false, why: 'skipped' };
  if (p.answer && p.answer.in) return { in: true, why: 'said_in' };
  if (p.unanswered >= SNOOZE_AFTER_UNANSWERED) return { in: false, why: 'snoozed' };
  if (p.paid) return { in: true, why: 'package' };
  if (p.proven) return { in: true, why: 'regular' };
  if ((p.joinedAtMs || 0) >= weekStartMs - NEW_GRACE_MS) return { in: true, why: 'new' };
  return { in: false, why: 'not_confirmed' };
}

// The availability the planner uses for a week: the learner's free times,
// narrowed to the days they picked for that week (own-clock weekdays).
function weekAvailability(availability, answer) {
  const list = Array.isArray(availability) ? availability : [];
  // Picked hours replace that week's times (a day with no usual free time
  // can be added, a usual one left out); consecutive hours become one range.
  if (answer && answer.in && answer.hours) {
    const out = [];
    for (const [wd, hs] of Object.entries(answer.hours)) {
      let start = hs[0];
      for (let i = 1; i <= hs.length; i += 1) {
        if (hs[i] === hs[i - 1] + 1) continue;
        out.push({ day: Number(wd), startMin: start * 60, endMin: (hs[i - 1] + 1) * 60 });
        start = hs[i];
      }
    }
    return out.sort((a, b) => a.day - b.day || a.startMin - b.startMin);
  }
  if (!answer || !answer.in || !answer.days || !answer.days.length) return list;
  const days = new Set(answer.days);
  return list.filter((r) => days.has(r.day));
}

// How many they want that week: the picked days (one practice a day), else
// their usual weekly number.
function weekTarget(weeklyTarget, answer) {
  const usual = Math.min(4, Math.max(0, Math.floor(Number(weeklyTarget) || 0)));
  if (answer && answer.in && answer.days && answer.days.length) return Math.min(4, answer.days.length);
  return usual;
}

// One-line summary for the admin: counts per reason.
function summarize(verdicts) {
  const out = { in: 0, out: 0, why: {} };
  for (const v of verdicts) {
    out[v.in ? 'in' : 'out'] += 1;
    out.why[v.why] = (out.why[v.why] || 0) + 1;
  }
  return out;
}

module.exports = {
  ASLEEP_AFTER_MS, NEW_GRACE_MS, SNOOZE_AFTER_UNANSWERED, FAIR_WINDOW_MS, PROVEN_WINDOW_MS,
  weekAnswer, parseHours, unansweredStreak, provenRecently, eligible, weekAvailability, weekTarget, summarize,
};

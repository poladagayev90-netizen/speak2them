// ── Account health: who may be planned at all ──
// (2026-10-14, the AI-planner plan, Mərhələ 1.) Six weeks of production
// offers: 42 sent, 3 confirmed. 17 were answered by nobody; 7 of the 19
// people offered had never made a single call, and one who had not opened
// the app for 13 days got 9 offers. Every such offer held a real learner
// hostage until it ran out. The planner now looks at each account first and
// plans only the ones that show signs of life.
//
//   active      seen in the last 7 days and has practised (or answers)
//   new         no call yet, but joined in the last 14 days or said «in»
//   sleeping    not seen for 7–21 days, or left 2 proposals in a row,
//               or never practised and never said «in» since joining
//   ghost       not seen for 21+ days, or no call ever and 3 proposals left
//   suspicious  flagged (by the admin, later the AI analyst) until cleared
//
// Only active and new are planned. Nothing here is a penalty the learner
// sees: one tap («I'm in» for the week) or opening the app brings them back.
//
// Pure: index.js reads the docs and passes plain values.

const DAY_MS = 24 * 60 * 60 * 1000;
const SLEEPING_AFTER_MS = 7 * DAY_MS;
const GHOST_AFTER_MS = 21 * DAY_MS;
const NEW_FOR_MS = 14 * DAY_MS;
const SLEEP_AFTER_UNANSWERED = 2;
const GHOST_AFTER_UNANSWERED = 3;

const PLANNED = new Set(['active', 'new']);

// person: { lastSeenMs, callCount, joinedAtMs, unanswered, committed, flag }
//   unanswered — proposals left to run out in a row, since their last sign of
//                life (autoRoster.unansweredStreak)
//   committed  — said «I'm in» for the week being planned
//   flag       — 'suspicious' while the admin has not cleared it
function classify(person, { nowMs }) {
  const p = person || {};
  if (p.flag === 'suspicious') return { cls: 'suspicious', why: 'flagged' };
  const away = nowMs - (Number(p.lastSeenMs) || 0);
  const calls = Number(p.callCount) || 0;
  const unanswered = Number(p.unanswered) || 0;
  if (away > GHOST_AFTER_MS) return { cls: 'ghost', why: 'away_21d' };
  if (!calls && unanswered >= GHOST_AFTER_UNANSWERED) return { cls: 'ghost', why: 'never_answered' };
  if (away > SLEEPING_AFTER_MS) return { cls: 'sleeping', why: 'away_7d' };
  // Saying «in» for the week is the newest sign of life: it outweighs
  // proposals that ran out before it (the streak is already counted from it).
  if (unanswered >= SLEEP_AFTER_UNANSWERED && !p.committed) return { cls: 'sleeping', why: 'silent' };
  if (!calls) {
    const fresh = nowMs - (Number(p.joinedAtMs) || 0) <= NEW_FOR_MS;
    if (fresh || p.committed) return { cls: 'new', why: fresh ? 'joined' : 'said_in' };
    return { cls: 'sleeping', why: 'no_first_call' };
  }
  return { cls: 'active', why: p.committed ? 'said_in' : 'practising' };
}

const planned = (verdict) => !!verdict && PLANNED.has(verdict.cls);

// Counts per class, for the admin's one-line summary.
function summarize(verdicts) {
  const out = { active: 0, new: 0, sleeping: 0, ghost: 0, suspicious: 0 };
  for (const v of verdicts) out[v.cls] = (out[v.cls] || 0) + 1;
  return out;
}

module.exports = {
  SLEEPING_AFTER_MS, GHOST_AFTER_MS, NEW_FOR_MS, SLEEP_AFTER_UNANSWERED, GHOST_AFTER_UNANSWERED,
  classify, planned, summarize,
};

// Reliability (scheduled practice, Phase 5): did this learner keep the
// practices they CONFIRMED?
//
// Pure — no Firestore. index.js feeds it the learner's attendance events and
// writes the result to admin-only reliability/{uid}; only the consequence (a
// smaller weekly plan) and the way back are shown to the learner.
//
// What counts (last RELIABILITY_WINDOW_MS, booked practices only):
//   no_show      +1     confirmed, never came
//   late_cancel  +0.5   confirmed, cancelled < 2 h before
//   attended     −0.5   a booked practice that happened (never below 0)
// What never counts: partner_no_show and unmatched (the PLATFORM failed
// them), a cancel in good time, an unanswered or declined proposal (nothing
// was promised until both said yes), and direct calls outside a booking.
//
// Levels:
//   ok       under 1 point
//   watch    1 point or more — the admin sees it, nothing changes for the learner
//   limited  3 points, or the last two booked practices were both no-shows —
//            the weekly plan offers ONE practice a week and never pairs them
//            with a newcomer.
// Way back: two booked practices attended in a row lift the limit and start
// the count again from zero. An admin reset (resetAtMs) forgets everything
// before it.

const RELIABILITY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
const WEIGHT = { no_show: 1, late_cancel: 0.5 };
const ATTENDED_CREDIT = 0.5;
const WATCH_AT = 1;
const LIMIT_AT = 3;
const RECOVER_AFTER = 2;
const LIMITED_TARGET = 1;

// events: [{ outcome, atMs, slotId }] — attendance docs, any order.
function computeReliability(events, { nowMs = Date.now(), resetAtMs = 0 } = {}) {
  const since = Math.max(nowMs - RELIABILITY_WINDOW_MS, Number(resetAtMs) || 0);
  const counted = (events || [])
    .filter((e) => Number(e.atMs) >= since && Number(e.atMs) <= nowMs)
    .filter((e) => (e.outcome === 'attended' ? !!e.slotId : e.outcome in WEIGHT))
    .sort((a, b) => a.atMs - b.atMs);

  let points = 0;
  let limited = false;
  let noShowRun = 0;   // no-shows in a row (a late cancel does not break or extend it)
  let attendedRun = 0; // attended in a row since the last miss
  let limitedSinceMs = null;
  const tally = { noShow: 0, lateCancel: 0, attended: 0 };

  for (const e of counted) {
    if (e.outcome === 'attended') {
      tally.attended += 1;
      attendedRun += 1;
      noShowRun = 0;
      if (limited && attendedRun >= RECOVER_AFTER) {
        limited = false;
        limitedSinceMs = null;
        points = 0;
      } else if (!limited) {
        points = Math.max(0, points - ATTENDED_CREDIT);
      }
      continue;
    }
    attendedRun = 0;
    points += WEIGHT[e.outcome];
    if (e.outcome === 'no_show') { tally.noShow += 1; noShowRun += 1; } else tally.lateCancel += 1;
    if (!limited && (points >= LIMIT_AT || noShowRun >= 2)) {
      limited = true;
      limitedSinceMs = Number(e.atMs);
    }
  }

  const level = limited ? 'limited' : points >= WATCH_AT ? 'watch' : 'ok';
  return {
    level,
    points,
    ...tally,
    limitedSinceMs,
    recoverLeft: limited ? RECOVER_AFTER - attendedRun : 0,
  };
}

// What the learner reads (planStatus.limit). The number stays hidden; the
// reason and the way back do not.
function limitNotice(rel, usualTarget) {
  if (!rel || rel.level !== 'limited') return null;
  const misses = rel.noShow + rel.lateCancel;
  const back = Math.max(LIMITED_TARGET, Number(usualTarget) || LIMITED_TARGET);
  return {
    active: true,
    target: LIMITED_TARGET,
    usualTarget: back,
    missed: misses,
    recoverLeft: rel.recoverLeft,
    since: rel.limitedSinceMs,
  };
}

module.exports = {
  computeReliability, limitNotice,
  RELIABILITY_WINDOW_MS, LIMITED_TARGET, RECOVER_AFTER,
};

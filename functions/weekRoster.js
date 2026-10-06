// Who may join practice sessions in a week: weekRoster/{monday}.uids, picked
// by the admin in Admin → Week. Polad (2026-10-02): the server kept planning
// and matching accounts nobody meant to practise — test accounts, people who
// signed up and left — so a session is open only to the people chosen for
// that week. No list for a week means NOBODY is in it: the admin picks first
// ("Copy last week" makes that one tap). Direct calls between two people who
// know each other are not sessions and are not gated.
//
// Gated: the weekly plan and its refill (loadPlannerInputs), joining a
// practice block (joinSlotTx — the HTTP join and recurring slots), and random
// search on old APKs (canPair without `direct`).

const MAX_UIDS = 500;

function rosterSet(data) {
  const uids = data && Array.isArray(data.uids) ? data.uids : [];
  return new Set(uids.filter((u) => typeof u === "string" && u).slice(0, MAX_UIDS));
}

// `data` is the roster doc's data, or null when the week has none.
// Autopilot (rosterMode "auto", autoRoster.js): the doc carries the planner's
// verdicts (`autoIn`) plus the admin's override (`include` / `exclude`).
// Before the planner has looked at the week at all, nobody is turned away.
function inRoster(data, uid) {
  if (!uid) return false;
  if (data && data.auto) {
    const list = (k) => (Array.isArray(data[k]) ? data[k] : []);
    if (list("exclude").includes(uid)) return false;
    if (list("include").includes(uid)) return true;
    return !data.autoAt || list("autoIn").includes(uid);
  }
  return rosterSet(data).has(uid);
}

module.exports = { MAX_UIDS, rosterSet, inRoster };

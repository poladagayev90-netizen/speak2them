// ── Who stays out of PEER pairing (2026-11-21) ──
// Plan: docs/plans/2026-11-21_newcomer_paths.md, item 2.
//
// The bug that started it: Polad opened a fresh test account and the refill
// booked it at once with a real learner (Khadija) — whom he had just told on
// WhatsApp that a teacher would join her first practice. Nothing in the data
// said «this person waits for a teacher» or «this is a test account».
//
//   • HOLD  — newcomerPath/{uid}.hold (server-written): the learner chose, or
//             the admin set, teacher support first. Until that session has
//             happened they meet only the team: a newcomer host, the admin,
//             or their own linked teacher. Lifted by the server after an
//             attended practice with one of them, by the admin, or (later)
//             by the learner choosing «partner».
//   • TEST  — users.testAccount (rules-protected, admin-set): a test account
//             meets only another test account or the team.
//
// Pure: index.js reads the docs and passes plain values. pairVerdict and the
// planner (weeklyPlanner.pairAllowed) both follow this — the API never says
// which rule refused.

// Is `otherUid` someone a held / test account may still meet?
// team = the admin identity or a configured newcomer host; teacher = the
// learner's own linked teacher (users.teacherId, set with consent).
function isTeam(otherUid, { adminUid, hostUids = [], teacherId = null } = {}) {
  if (!otherUid) return false;
  if (otherUid === adminUid) return true;
  if (teacherId && otherUid === teacherId) return true;
  return hostUids.includes(otherUid);
}

// { held, testClash } for a pair. `a`, `b` = users docs (or {}),
// `holdA`, `holdB` = newcomerPath.hold of each side.
function peerGuard({ uidA, uidB, a = {}, b = {}, holdA = false, holdB = false, adminUid, hostUids = [] }) {
  const teamForA = isTeam(uidB, { adminUid, hostUids, teacherId: a.teacherId || null });
  const teamForB = isTeam(uidA, { adminUid, hostUids, teacherId: b.teacherId || null });
  const held = (holdA === true && !teamForA) || (holdB === true && !teamForB);
  const testA = a.testAccount === true;
  const testB = b.testAccount === true;
  const testClash = testA !== testB && !(testA ? teamForA : teamForB);
  return { held, testClash };
}

// Lift the hold after this practice? Only an attended one with the team.
function liftsHold({ uid, peerUid, user = {}, adminUid, hostUids = [] }) {
  return !!uid && isTeam(peerUid, { adminUid, hostUids, teacherId: user.teacherId || null });
}

module.exports = { isTeam, peerGuard, liftsHold };

// Turning the AI analyst's answer into something the planner can trust.
//
// The model may return anything: ids it was never shown, scores out of range,
// long or odd text. Nothing it says reaches Firestore or a learner without
// passing here. What it can change is small on purpose:
//   • a pair score in [-AI_BONUS_MAX, +AI_BONUS_MAX] for pairs it was SHOWN
//     (all of them already allowed by the hard rules);
//   • at most MAX_FLAGS «look at this account» suggestions — the admin
//     decides (Admin → Agent), the AI never flags anyone itself;
//   • a short report for the admin, aliases turned back into names.
//
// Pure.

const { AI_BONUS_MAX } = require('../weeklyPlanner');

const MAX_FLAGS = 5;
const MAX_WHY = 80;
const MAX_REPORT = 1500;

const clean = (v, max) => String(v == null ? '' : v).replace(/[\s\p{Cc}]+/gu, ' ').trim().slice(0, max);

// json: the model's parsed output { pairs: [{id, score, why}], flags: [{person, why}], report }
// ctx:  { pairIndex: Map pN → pairKey, uidOf: Map Ln → uid, nameOf: (uid) → name }
function parseAgentOutput(json, { pairIndex, uidOf, nameOf = () => '' }) {
  const out = { aiBonus: new Map(), flags: [], report: '', dropped: 0 };
  const o = json && typeof json === 'object' ? json : {};
  // The admin reads names, not aliases — in the report and in every reason;
  // the longest alias first so L12 is not read as L1 followed by a 2.
  const aliases = [...uidOf.keys()].sort((x, y) => y.length - x.length);
  const deAlias = (text) => aliases.reduce(
    (t, a) => t.replace(new RegExp(`\\b${a}\\b`, 'g'), nameOf(uidOf.get(a)) || a), text);
  for (const p of Array.isArray(o.pairs) ? o.pairs : []) {
    const key = p && pairIndex.get(String(p.id));
    const n = Number(p && p.score);
    if (!key || !Number.isFinite(n)) { out.dropped += 1; continue; }
    const score = Math.round(Math.max(-AI_BONUS_MAX, Math.min(AI_BONUS_MAX, n)) * 2) / 2;
    if (!score || out.aiBonus.has(key)) continue;
    out.aiBonus.set(key, { score, why: deAlias(clean(p.why, MAX_WHY)) });
  }
  const seen = new Set();
  for (const f of Array.isArray(o.flags) ? o.flags : []) {
    const uid = f && uidOf.get(String(f.person));
    if (!uid || seen.has(uid)) { out.dropped += 1; continue; }
    seen.add(uid);
    out.flags.push({ uid, why: deAlias(clean(f.why, MAX_WHY)) });
    if (out.flags.length >= MAX_FLAGS) break;
  }
  out.report = deAlias(clean(o.report, MAX_REPORT));
  return out;
}

module.exports = { MAX_FLAGS, parseAgentOutput };

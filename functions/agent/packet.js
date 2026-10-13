// What the AI analyst sees — and only that (Mərhələ 2, 2026-10-14).
//
// Privacy: Google gets an alias per learner for this one run (L1, L2 …), the
// CEFR level and numbers about their practice. Never a name, uid, age band,
// country, WhatsApp, e-mail, time zone, transcript or chat text. The alias →
// uid map stays in the function's memory.
//
// Size: a pair is a candidate only when the hard rules allow it AND both are
// free at a shared start (weeklyPlanner.candidatePairs). Each learner keeps
// their PER_PERSON most likely partners, so the packet grows with the crowd,
// not with its square (500 learners ≈ 2 000 pairs ≈ 50k tokens).
//
// Pure: index.js loads the signals and passes plain values.

const PER_PERSON = 8;
const TAGS = ['on_time', 'let_me_speak', 'respectful', 'prepared'];
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const levelOf = (level) => {
  const m = /^(A1|A2|B1|B2|C1|C2)\b/.exec(String(level || ''));
  return m ? m[1] : null;
};
const gapOf = (a, b) => {
  const x = LEVELS.indexOf(levelOf(a)); const y = LEVELS.indexOf(levelOf(b));
  return x < 0 || y < 0 ? null : Math.abs(x - y);
};

// A rough prior used only to choose which candidates the AI sees when a
// learner has more than PER_PERSON: starred first, close level, not met.
function prior(pair, info) {
  const gap = gapOf(info.get(pair.a)?.level, info.get(pair.b)?.level);
  return (pair.fav || 0) * 3 - (gap == null ? 1 : gap) - (pair.recent ? 2 : 0) + Math.min(3, pair.shared.length) * 0.1;
}

// learners:   planner learners (uid, level, need, committed, newcomer, limited)
// candidates: weeklyPlanner.candidatePairs output ({ key, a, b, shared })
// signals:    Map uid → { health, calls, attended, noShow, lateCancel, declined,
//             unanswered, reliability, tags: {tag: n} }
// pairSignals: Map pairKey → { fav, recent, tagsAB: [..], tagsBA: [..], declinedTogether }
function buildPacket({ learners, candidates, signals = new Map(), pairSignals = new Map(), week = {}, perPerson = PER_PERSON }) {
  const info = new Map(learners.map((l) => [l.uid, l]));
  const alias = new Map();
  const uidOf = new Map();
  for (const l of learners) {
    const id = `L${alias.size + 1}`;
    alias.set(l.uid, id);
    uidOf.set(id, l.uid);
  }
  // Keep each person's top candidates (a pair stays if either side keeps it).
  const enriched = candidates.map((c) => ({ ...c, ...(pairSignals.get(c.key) || {}) }));
  const keep = new Set();
  const byPerson = new Map();
  for (const c of enriched) {
    for (const u of [c.a, c.b]) {
      if (!byPerson.has(u)) byPerson.set(u, []);
      byPerson.get(u).push(c);
    }
  }
  for (const list of byPerson.values()) {
    list.sort((x, y) => prior(y, info) - prior(x, info) || (x.key < y.key ? -1 : 1));
    for (const c of list.slice(0, perPerson)) keep.add(c.key);
  }
  const pairIndex = new Map();
  const pairs = [];
  for (const c of enriched) {
    if (!keep.has(c.key)) continue;
    const id = `p${pairs.length + 1}`;
    pairIndex.set(id, c.key);
    const days = new Set(c.shared.map((s) => s.slice(0, 10)));
    pairs.push({
      id, a: alias.get(c.a), b: alias.get(c.b),
      level_gap: gapOf(info.get(c.a)?.level, info.get(c.b)?.level),
      shared_days: days.size,
      starred: c.fav || 0,
      met_last_7_days: !!c.recent,
      ...(c.tagsAB && c.tagsAB.length ? { a_said_of_b: c.tagsAB.filter((t) => TAGS.includes(t)) } : {}),
      ...(c.tagsBA && c.tagsBA.length ? { b_said_of_a: c.tagsBA.filter((t) => TAGS.includes(t)) } : {}),
      ...(c.declinedTogether ? { declined_together: c.declinedTogether } : {}),
    });
  }
  const people = learners.map((l) => {
    const s = signals.get(l.uid) || {};
    return {
      id: alias.get(l.uid),
      level: levelOf(l.level),
      wants: l.need,
      said_in: !!l.committed,
      health: s.health || null,
      calls_ever: Number(s.calls) || 0,
      last_28_days: {
        attended: Number(s.attended) || 0,
        no_show: Number(s.noShow) || 0,
        late_cancel: Number(s.lateCancel) || 0,
        declined_offers: Number(s.declined) || 0,
        unanswered_in_a_row: Number(s.unanswered) || 0,
      },
      reliability: s.reliability || 'ok',
      ...(s.tags && Object.keys(s.tags).length ? { partners_said: s.tags } : {}),
    };
  });
  return { alias, uidOf, pairIndex, packet: { week, people, pairs } };
}

module.exports = { PER_PERSON, buildPacket, levelOf };

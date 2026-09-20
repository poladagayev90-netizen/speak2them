// Faza 7 — "did you apply the last correction?"
//
// The aggregate in users/{uid}/insights already answers "what do I get wrong"
// (counters per concept) and "am I scoring better" (a series of session
// scores). Neither answers the question a learner actually asks after a
// report: I was told to fix my articles — did I?
//
// That question can only be answered by carrying something FORWARD. After each
// analysis we pin the concepts the learner was corrected on (`focus`), and the
// NEXT analysis measures those same concepts again and stores the verdict
// (`focusReview`). Both live on users/{uid}/insights/progress so the progress
// room still opens in two reads.
//
// WHY NO SECOND LLM CALL: asking a model "did they apply last week's advice"
// means trusting it to compare two transcripts it can only see one of, and it
// would happily answer "yes, great improvement!" either way. Everything here is
// arithmetic over conceptStats, where `errors` is already transcript-verified
// (see the analysis normaliser: a correction whose quote is not in the
// transcript is dropped before it is ever counted). A number we computed can be
// shown to the learner; a compliment the model invented cannot.

// How many concepts we carry into the next session. Three is the most a person
// can hold in their head during a conversation; a list of ten is a list of none.
const FOCUS_ITEMS = 3;

// Below this many uses of the concept in the next session we refuse to judge
// it. Two uses of the past simple say nothing about whether the past simple
// improved — printing "fixed!" off one clean sentence is the kind of flattery
// that makes every other number on the page worthless.
const FOCUS_MIN_ATTEMPTS = 3;

// Per-session concept slice stored inside the series entry, for the per-concept
// timeline. The series holds 30 sessions, so this cap is what keeps the
// progress document small: 30 × 8 short entries, not 30 × 30.
const SERIES_CONCEPTS = 8;

// Verified examples kept per focus concept, so the carry-over card can show the
// learner their OWN sentence rather than a textbook rule.
const FOCUS_EXAMPLES = 2;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function errorRate({ attempts, errors }) {
  return num(errors) / Math.max(1, num(attempts));
}

// {concept, attempts, errors}[] → { [concept]: {attempts, errors} }
function statsByConcept(conceptStats) {
  const out = {};
  for (const row of Array.isArray(conceptStats) ? conceptStats : []) {
    if (!row || typeof row.concept !== 'string') continue;
    out[row.concept] = { attempts: num(row.attempts), errors: num(row.errors) };
  }
  return out;
}

// The compact per-session map stored in the series: { articles: [12, 3] }.
// Array rather than {attempts, errors} because this is repeated 30 times and
// the key names would be most of the bytes.
function seriesConcepts(conceptStats, limit = SERIES_CONCEPTS) {
  const rows = (Array.isArray(conceptStats) ? conceptStats : [])
    .filter((r) => r && typeof r.concept === 'string' && num(r.attempts) > 0)
    .sort((a, b) => num(b.errors) - num(a.errors) || num(b.attempts) - num(a.attempts))
    .slice(0, limit);
  const out = {};
  for (const r of rows) out[r.concept] = [num(r.attempts), Math.min(num(r.attempts), num(r.errors))];
  return out;
}

// Was the pinned concept actually better this time?
//
//   unseen — it barely came up; we say so instead of guessing
//   clean  — used enough times with no correction at all
//   better — the error RATE fell clearly (rate, not count: a longer session
//            produces more of everything)
//   again  — the rate rose clearly
//   same   — it moved, but not enough to call
function verdictFor(before, after) {
  if (num(after.attempts) < FOCUS_MIN_ATTEMPTS) return 'unseen';
  if (num(after.errors) === 0) return 'clean';
  const b = errorRate(before);
  const a = errorRate(after);
  if (a <= b * 0.6) return 'better';
  if (a >= b * 1.4) return 'again';
  return 'same';
}

// Compare the focus pinned by the PREVIOUS analysis against this session.
// Returns null when there is nothing pinned yet (the first analysed session).
function reviewFocus(prevFocus, conceptStats, { at = Date.now(), analysisId = null } = {}) {
  const items = Array.isArray(prevFocus?.items) ? prevFocus.items : [];
  if (!items.length) return null;
  const now = statsByConcept(conceptStats);

  return {
    at,
    analysisId,
    // The session the focus was set by, so the UI can say "since your last
    // report" and a stale review is recognisable rather than silently old.
    fromAt: num(prevFocus.at) || null,
    items: items.map((item) => {
      const before = { attempts: num(item.attempts), errors: num(item.errors) };
      const after = now[item.concept] || { attempts: 0, errors: 0 };
      return { concept: item.concept, before, after, verdict: verdictFor(before, after) };
    }),
  };
}

// What to carry into the next session: the concepts this session was actually
// corrected on, worst first, each with up to two of the learner's own
// sentences.
//
// A session with no corrections does NOT clear the focus — it keeps the
// previous one. Otherwise one clean call would erase the thing we are tracking
// and the learner would never find out whether it stuck. The baseline stays the
// session that produced it, which is exactly what "since we flagged it" means.
function nextFocus(conceptStats, errorThemes, prevFocus, { at = Date.now(), analysisId = null } = {}) {
  const examples = {};
  for (const theme of Array.isArray(errorThemes) ? errorThemes : []) {
    for (const item of Array.isArray(theme?.items) ? theme.items : []) {
      if (!item || typeof item.concept !== 'string') continue;
      if (!item.original || !item.corrected) continue;
      const list = examples[item.concept] || (examples[item.concept] = []);
      if (list.length < FOCUS_EXAMPLES) {
        list.push({ original: String(item.original), corrected: String(item.corrected) });
      }
    }
  }

  const items = (Array.isArray(conceptStats) ? conceptStats : [])
    .filter((r) => r && typeof r.concept === 'string' && num(r.errors) > 0)
    .sort((a, b) => num(b.errors) - num(a.errors) || num(b.attempts) - num(a.attempts))
    .slice(0, FOCUS_ITEMS)
    .map((r) => ({
      concept: r.concept,
      attempts: num(r.attempts),
      errors: Math.min(num(r.attempts), num(r.errors)),
      examples: examples[r.concept] || [],
    }));

  if (!items.length) return prevFocus && Array.isArray(prevFocus.items) && prevFocus.items.length
    ? prevFocus
    : null;

  return { at, analysisId, items };
}

module.exports = {
  FOCUS_ITEMS,
  FOCUS_MIN_ATTEMPTS,
  SERIES_CONCEPTS,
  statsByConcept,
  seriesConcepts,
  verdictFor,
  reviewFocus,
  nextFocus,
};

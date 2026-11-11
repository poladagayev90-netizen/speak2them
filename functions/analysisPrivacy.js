// "The teacher sees TYPES, never the conversation" (Polad, 2026-11-11) — pure
// helpers, tested in analysisPrivacy.test.js.
//
// Learners talk about their own lives in a practice call. The report used to
// quote those sentences as mistake examples, and the linked teacher read the
// whole callAnalysis doc — transcript included. Students noticed and stopped
// talking freely, which is the one thing the practice is for.
//
// So every mistake now carries two examples:
//   original / corrected      — the learner's own words. Student-only.
//   neutralExample            — a short generic sentence with the SAME grammar
//                               or pronunciation issue and nothing personal.
// and the teacher never reads callAnalysis or the learner's insights/progress
// doc at all. The worker writes a PROJECTION for them instead
// (callAnalysisTeacher/{id}, users/{uid}/insights/teacherProgress) built by
// the functions below. Firestore rules cannot hide a field, so the split has to
// be by document: what is not in the projection cannot leak through a query.
//
// Reports written before this change have no neutral example. Their teacher
// projection keeps the pattern (title + concept + count) and nothing quoted —
// not even the theme's rule, which the old prompt allowed to carry a "wrong →
// right" pair. Nothing is regenerated with AI.

// Bumped when the prompt's privacy rules change. A report carrying it was
// written under the sensitive-topic filter, so its rule and neutral pairs are
// safe to show a teacher.
const PRIVACY_VERSION = 1;

const MAX_NEUTRAL_CHARS = 160;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

const normText = (v) => String(v || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// True when `a` repeats most of `b`'s content words — a "neutral" sentence
// that is really the learner's own sentence again. The model is told to write a
// fresh sentence; this is the check that it did.
function echoes(a, b) {
  const words = normText(b).split(' ').filter((w) => w.length > 3);
  if (!words.length) return false;
  const hay = ` ${normText(a)} `;
  const hits = words.filter((w) => hay.includes(` ${w} `)).length;
  return hits / words.length >= 0.6;
}

// The model's flat neutral_original / neutral_corrected (flat on purpose: one
// more nested object in the Gemini schema risks its size-limit 400) → a
// validated { original, corrected } or null.
function neutralFrom(raw, ownOriginal = '', ownCorrected = '') {
  const original = str(raw && (raw.neutral_original ?? raw.original));
  const corrected = str(raw && (raw.neutral_corrected ?? raw.corrected));
  if (!original || !corrected) return null;
  if (original.length > MAX_NEUTRAL_CHARS || corrected.length > MAX_NEUTRAL_CHARS) return null;
  if (normText(original) === normText(corrected)) return null;
  if (ownOriginal && (echoes(original, ownOriginal) || echoes(corrected, ownOriginal))) return null;
  if (ownCorrected && echoes(corrected, ownCorrected)) return null;
  return { original, corrected };
}

// "Hide from teacher" (2026-11-12): the learner can keep any single example
// to themselves from their report. The flag sits on the item in callAnalysis
// (and on its carry-over copy in insights/progress) and is written only by
// setExampleVisibility. Every teacher-facing path reads examples through
// neutralOf, so a hidden item has no example anywhere a teacher looks — the
// projections, classBrief, the homework doc. The mistake still counts as a
// TYPE (the teacher sees types; that promise is unchanged).
const isHidden = (item) => !!(item && item.hiddenFromTeacher === true);

function neutralOf(item) {
  if (isHidden(item)) return null;
  const n = item && item.neutralExample;
  return n && str(n.original) && str(n.corrected) ? { original: str(n.original), corrected: str(n.corrected) } : null;
}

const isPrivate = (analysis) => Number(analysis && analysis.privacyVersion) >= PRIVACY_VERSION;

// Error themes as a teacher may see them: the pattern, the concept ids, and
// only the neutral examples. A theme whose examples were all personal still
// shows as a pattern with a count — the teacher learns WHAT to practise.
function teacherThemes(errorThemes, analysis) {
  const safe = isPrivate(analysis);
  return (Array.isArray(errorThemes) ? errorThemes : [])
    .map((t) => {
      const items = Array.isArray(t && t.items) ? t.items : [];
      return {
        title: str(t && t.title),
        rule: safe ? str(t && t.rule) : '',
        count: items.length,
        concepts: [...new Set(items.map((i) => i && i.concept).filter((c) => typeof c === 'string' && c))],
        items: safe
          ? items.map((i) => {
            const n = neutralOf(i);
            return n ? { original: n.original, corrected: n.corrected, concept: (i && i.concept) || null, generic: true } : null;
          }).filter(Boolean)
          : [],
      };
    })
    .filter((t) => t.title);
}

// callAnalysisTeacher/{id}. An allow-list, never a copy-and-delete: a field
// added to the report later stays student-only until someone decides here
// that a teacher may see it.
function teacherAnalysis(analysis) {
  const a = analysis || {};
  const safe = isPrivate(a);
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const scores = a.scores && typeof a.scores === 'object' ? a.scores : {};
  const pace = a.speakingPace && typeof a.speakingPace === 'object' ? a.speakingPace : null;
  const out = {
    teacherView: true,
    privacyVersion: safe ? Number(a.privacyVersion) : 0,
    userId: str(a.userId) || null,
    status: a.status === 'failed' ? 'failed' : 'done',
    source: str(a.source) || 'call',
    overallScore: num(a.overallScore),
    scores: {
      fluency: num(scores.fluency),
      grammar: num(scores.grammar),
      vocabulary: num(scores.vocabulary),
    },
    speakingPace: pace && Number.isFinite(Number(pace.wpm)) ? { wpm: Number(pace.wpm) } : null,
    durationSeconds: num(a.durationSeconds) || 0,
    errorThemes: teacherThemes(a.errorThemes, a),
    conceptStats: (Array.isArray(a.conceptStats) ? a.conceptStats : [])
      .filter((c) => c && typeof c.concept === 'string')
      .map((c) => ({ concept: c.concept, attempts: Number(c.attempts) || 0, errors: Number(c.errors) || 0 })),
  };
  // Pronunciation is a mistake TYPE too, but only from reports whose prompt
  // forbade picking a name or a place as the word.
  if (safe) {
    out.pronunciation = (Array.isArray(a.pronunciation) ? a.pronunciation : [])
      .filter((p) => p && str(p.word) && str(p.should))
      .map((p) => ({ word: str(p.word), should: str(p.should), times: Number(p.times) || 1 }));
  }
  if (a.timestamp !== undefined) out.timestamp = a.timestamp;
  return out;
}

// users/{uid}/insights/teacherProgress — the progress doc with every
// carry-over example swapped for its neutral pair (or dropped).
function teacherProgress(progress) {
  const p = progress && typeof progress === 'object' ? progress : {};
  const strip = (focus) => {
    if (!focus || !Array.isArray(focus.items)) return focus || null;
    return {
      ...focus,
      items: focus.items.map((it) => ({
        ...it,
        examples: (Array.isArray(it && it.examples) ? it.examples : [])
          .map(neutralOf)
          .filter(Boolean),
      })),
    };
  };
  const out = {
    teacherView: true,
    wordCount: Number(p.wordCount) || 0,
    lastNewWords: Number(p.lastNewWords) || 0,
    series: Array.isArray(p.series) ? p.series : [],
  };
  if (p.focus) out.focus = strip(p.focus);
  if (p.focusReview) out.focusReview = p.focusReview;
  return out;
}

// Sets or clears the flag on errorThemes[themeIdx].items[itemIdx]. Returns a
// new errorThemes array, or null when the address does not point at an item.
function setItemHidden(errorThemes, themeIdx, itemIdx, hidden) {
  const themes = Array.isArray(errorThemes) ? errorThemes : [];
  const t = themes[themeIdx];
  const items = Array.isArray(t && t.items) ? t.items : null;
  if (!items || !items[itemIdx] || typeof items[itemIdx] !== 'object') return null;
  return themes.map((th, ti) => (ti !== themeIdx ? th : {
    ...th,
    items: items.map((it, ii) => {
      if (ii !== itemIdx) return it;
      const { hiddenFromTeacher, ...rest } = it;
      return hidden ? { ...rest, hiddenFromTeacher: true } : rest;
    }),
  }));
}

// The same flag on the carry-over examples in insights/progress.focus: they
// are copies of report items (learningFocus.nextFocus), matched by the
// learner's own sentence pair. Returns the new focus (unchanged object when
// nothing matched).
function setFocusHidden(focus, item, hidden) {
  if (!focus || !Array.isArray(focus.items) || !item) return focus || null;
  const same = (e) => e && str(e.original) === str(item.original) && str(e.corrected) === str(item.corrected)
    && (str(item.original) || (item.neutralExample && e.neutralExample
      && str(e.neutralExample.original) === str(item.neutralExample.original)));
  let changed = false;
  const items = focus.items.map((fi) => ({
    ...fi,
    examples: (Array.isArray(fi && fi.examples) ? fi.examples : []).map((e) => {
      if (!same(e)) return e;
      changed = true;
      const { hiddenFromTeacher, ...rest } = e;
      return hidden ? { ...rest, hiddenFromTeacher: true } : rest;
    }),
  }));
  return changed ? { ...focus, items } : focus;
}

// Lower-cased neutral sentences of the hidden items in one report — so an
// exercise the report built from such a sentence (the word-order fallback in
// normalizeAnalysis) can be left out of the teacher-readable homework too.
function hiddenSentences(analysis) {
  const out = new Set();
  for (const t of Array.isArray(analysis && analysis.errorThemes) ? analysis.errorThemes : []) {
    for (const i of Array.isArray(t && t.items) ? t.items : []) {
      if (!isHidden(i) || !i.neutralExample) continue;
      for (const k of ['original', 'corrected']) {
        const v = str(i.neutralExample[k]).toLowerCase();
        if (v) out.add(v);
      }
    }
  }
  return out;
}

// Anything quoting the learner, for the tests and the backfill's self-check:
// every original / corrected / transcript / quote string in the object that is
// not a neutral example.
function rawQuotes(analysis) {
  const out = [];
  if (!analysis || typeof analysis !== 'object') return out;
  if (str(analysis.transcript)) out.push(str(analysis.transcript));
  for (const t of Array.isArray(analysis.errorThemes) ? analysis.errorThemes : []) {
    for (const i of Array.isArray(t && t.items) ? t.items : []) {
      if (i && !i.generic && str(i.original)) out.push(str(i.original));
    }
  }
  return out;
}

module.exports = {
  PRIVACY_VERSION,
  neutralFrom,
  neutralOf,
  teacherThemes,
  teacherAnalysis,
  teacherProgress,
  rawQuotes,
  echoes,
  isHidden,
  setItemHidden,
  setFocusHidden,
  hiddenSentences,
};

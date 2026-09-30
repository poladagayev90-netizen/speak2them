// The small charts inside the Lab tiles. Pure, so it is tested without
// Firestore; the Lab reads the same progress document it already loads.
//
// Every point is a measured session. Nothing is smoothed or extrapolated: a
// learner with two sessions gets a two-point line, and one session draws no
// line at all (a single dot is not a trend).

const MAX_POINTS = 8;

// Oldest-first, last MAX_POINTS sessions.
function recentSessions(progressDoc) {
  const series = Array.isArray(progressDoc?.series) ? progressDoc.series : [];
  return series.slice(0, MAX_POINTS).reverse();
}

// Minutes spoken per session, for the bars under "Speaking time".
export function minutesPerSession(progressDoc) {
  return recentSessions(progressDoc).map((s) => Math.round((Number(s?.seconds) || 0) / 60));
}

// Speaking speed per session; sessions without a measured pace are skipped
// rather than drawn as a drop to zero.
export function wpmPerSession(progressDoc) {
  return recentSessions(progressDoc).map((s) => Number(s?.wpm) || 0).filter((v) => v > 0);
}

// "Words used" over time. The document stores the running total and each
// session's new words, so the earlier totals are walked back from the current
// one. Older entries without `nw` stop the walk: a guessed point is worse
// than a shorter line.
export function wordsOverTime(progressDoc) {
  const total = Number(progressDoc?.wordCount) || 0;
  if (!total) return [];
  const series = (Array.isArray(progressDoc?.series) ? progressDoc.series : []).slice(0, MAX_POINTS);
  const points = [total];
  let running = total;
  for (let i = 0; i < series.length - 1; i += 1) {
    const nw = Number(series[i]?.nw);
    if (!Number.isFinite(nw) || nw < 0) break;
    running = Math.max(0, running - nw);
    points.push(running);
  }
  return points.reverse();
}

export const CEFR_STEPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Index of the learner's level on the CEFR ladder, or -1 when it is unknown.
// The level only ever comes from the placement test ("B1 – Intermediate").
export function cefrIndex(level) {
  const short = typeof level === 'string' ? level.trim().slice(0, 2).toUpperCase() : '';
  return CEFR_STEPS.indexOf(short);
}

// ─── One session at a time (the Lab's session picker) ────────────────
// `analyses` are callAnalysis docs, newest first (as fetchAnalyses returns
// them). A failed or unfinished one is listed but never opened by default.

const ACTIVITY_LABEL = {
  describe: 'Describe', debate: 'Debate', taboo: 'Taboo', roleplay: 'Role-play', questions: 'Questions',
};

const isFinished = (a) => !!a && !a.error && Number(a.overallScore) > 0;

export function sessionTitle(a) {
  if (!a) return '';
  if (a.source === 'ainur') {
    const act = ACTIVITY_LABEL[a.activity] || (a.activity ? String(a.activity) : '');
    return act ? `AInur · ${act}` : 'AInur';
  }
  if (a.topicTitle) return String(a.topicTitle);
  return a.peerName ? `Call with ${a.peerName}` : 'Call';
}

// The Lab opens on the newest finished session; with none, on the totals.
export function defaultSession(analyses) {
  const first = (analyses || []).find(isFinished);
  return first ? first.id : 'all';
}

// A metric across the sessions up to and including the chosen one, oldest
// first — so the last point of the chart is always the session on screen.
export function sessionTrend(analyses, id, pick) {
  const list = analyses || [];
  const at = list.findIndex((a) => a.id === id);
  if (at < 0) return [];
  return list.slice(at).filter(isFinished).slice(0, MAX_POINTS).reverse()
    .map((a) => Number(pick(a)) || 0)
    .filter((v) => v > 0);
}

// Reader for the cross-session learning aggregate written by
// updateLearnerInsights (functions/index.js).
//
// The whole progress room is TWO document reads, by design: the counters live
// in one map inside users/{uid}/insights/grammar and the session series in
// users/{uid}/insights/progress. A subcollection per concept would have made
// opening the room thirty reads. users/{uid}/insights/vocabIndex holds the raw
// word list and is deliberately NOT read here — it grows to tens of kilobytes
// and only the server needs it; the count the UI shows is copied into
// `progress.wordCount` for exactly that reason.
//
// Everything here tolerates missing documents: a learner with no finished
// analysis has no insights docs at all, and that is the normal first state.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  GRAMMAR_CONCEPTS,
  conceptLabel,
  conceptDifficulty,
  conceptMastery,
  MASTERY_MIN_ATTEMPTS,
} from '../data/grammarConcepts';
import { getFeedbackLanguage } from './feedbackLanguage';

export async function fetchLearnerInsights(uid) {
  if (!uid) return { grammar: null, progress: null };
  const base = ['users', uid, 'insights'];
  const [grammarSnap, progressSnap] = await Promise.all([
    getDoc(doc(db, ...base, 'grammar')),
    getDoc(doc(db, ...base, 'progress')),
  ]);
  return {
    grammar: grammarSnap.exists() ? grammarSnap.data() : null,
    progress: progressSnap.exists() ? progressSnap.data() : null,
  };
}

// One row per concept the learner has actually attempted. Concepts they have
// never reached for are left out rather than shown at 0 — an untouched row is
// not a weakness, and thirty grey rows would bury the six that matter.
export function buildTrackerRows(grammarDoc, lang = getFeedbackLanguage()) {
  const concepts = grammarDoc?.concepts;
  if (!concepts || typeof concepts !== 'object') return [];

  return Object.entries(concepts)
    .map(([id, c]) => {
      const attempts = Number(c?.attempts) || 0;
      const errors = Math.min(attempts, Number(c?.errors) || 0);
      return {
        id,
        label: conceptLabel(id, lang),
        cefr: conceptDifficulty(id),
        attempts,
        errors,
        sessions: Number(c?.sessions) || 0,
        // Firestore Timestamp | undefined — the caller formats it.
        lastAt: c?.lastAt || null,
        mastery: conceptMastery({ attempts, errors }),
        // Under a handful of attempts the percentage is noise. The flag exists
        // so the UI can say "not enough data yet" instead of printing a number
        // that looks authoritative and will swing wildly next session.
        provisional: attempts < MASTERY_MIN_ATTEMPTS,
      };
    })
    .filter((r) => r.attempts > 0)
    // Weakest first, but provisional rows sink to the bottom regardless of
    // their number. They print "—", so leading the table with one puts the
    // concept we have explicitly refused to judge in the position that reads
    // as "your worst problem".
    .sort((a, b) => (
      (a.provisional ? 1 : 0) - (b.provisional ? 1 : 0)
      || (a.mastery ?? 101) - (b.mastery ?? 101)
      || b.attempts - a.attempts
    ));
}

// What to work on next: weakest first, but only where there is enough evidence
// to say so. Falls back to the highest error counts when nothing has cleared
// the evidence bar yet, so a new learner still gets an answer.
export function topWeaknesses(rows, count = 3) {
  const confident = rows.filter((r) => !r.provisional && r.errors > 0);
  const pool = confident.length ? confident : rows.filter((r) => r.errors > 0);
  return pool.slice(0, count);
}

// Coverage, for the empty/partial states: how much of the taxonomy has been
// seen at all. A tracker showing 4 of 30 concepts should say so rather than
// let the learner read it as a complete picture.
export function trackerCoverage(rows) {
  return { seen: rows.length, total: GRAMMAR_CONCEPTS.length };
}

// Oldest-first series for a chart. The stored array is newest-first (so the
// server can prepend and slice), which is the wrong order for a trend line.
export function progressSeries(progressDoc) {
  const series = Array.isArray(progressDoc?.series) ? progressDoc.series : [];
  return [...series].reverse();
}

// ─── Faza 7: the laboratory ────────────────────────────────────────
//
// Three readers over the same two documents. They add no reads: the per-session
// concept slice rides inside the series entries the room already loads, and the
// carry-over lives on the progress document beside it.
//
// All three tolerate entries written before Faza 7 (no `c`, `id` or `nw`
// fields) — the learner's older sessions simply carry less detail rather than
// breaking the page.

// One card per analysed session, newest first: the score, how long it ran, the
// pace, the words that were new that day and what the session was actually
// about (its corrected concepts).
export function sessionTickets(progressDoc, lang = getFeedbackLanguage()) {
  const series = Array.isArray(progressDoc?.series) ? progressDoc.series : [];
  return series.map((s) => {
    const concepts = Object.entries(s?.c && typeof s.c === 'object' ? s.c : {})
      .map(([id, pair]) => ({
        id,
        label: conceptLabel(id, lang),
        attempts: Number(pair?.[0]) || 0,
        errors: Number(pair?.[1]) || 0,
      }))
      .filter((c) => c.attempts > 0)
      .sort((a, b) => b.errors - a.errors || b.attempts - a.attempts);

    return {
      at: Number(s?.at) || 0,
      analysisId: typeof s?.id === 'string' ? s.id : null,
      overall: Number(s?.overall) || 0,
      wpm: Number(s?.wpm) || 0,
      seconds: Number(s?.seconds) || 0,
      newWords: Number(s?.nw) || 0,
      source: s?.source === 'ainur' ? 'ainur' : 'call',
      // What the learner was corrected on that day. A session where nothing was
      // corrected shows none — an empty list is the good outcome, not a gap.
      corrected: concepts.filter((c) => c.errors > 0).slice(0, 3),
      used: concepts.length,
    };
  });
}

// One concept over time, oldest first. Sessions where the concept never came up
// are LEFT OUT rather than plotted as zero: a day you did not use the passive
// is not a day you used it perfectly, and joining those points would draw a
// recovery that never happened.
export function conceptTimeline(progressDoc, conceptId) {
  const series = Array.isArray(progressDoc?.series) ? progressDoc.series : [];
  return series
    .filter((s) => s?.c && Array.isArray(s.c[conceptId]))
    .map((s) => {
      const attempts = Number(s.c[conceptId][0]) || 0;
      const errors = Math.min(attempts, Number(s.c[conceptId][1]) || 0);
      return {
        at: Number(s?.at) || 0,
        attempts,
        errors,
        // Percentage of uses that needed correcting. Rate, not count, so a long
        // session is not read as a bad one.
        rate: attempts > 0 ? Math.round((errors / attempts) * 100) : 0,
      };
    })
    .reverse();
}

// The carry-over: what the last report asked for, and what this session
// measured. `null` until a second session has been analysed — there is nothing
// to compare a first session against, and saying so beats an empty card.
export function focusReview(progressDoc, lang = getFeedbackLanguage()) {
  const review = progressDoc?.focusReview;
  const items = Array.isArray(review?.items) ? review.items : [];
  if (!items.length) return null;

  // The examples live on the CURRENT focus, keyed by concept, so a reviewed
  // item can show the learner the sentence that started it.
  const examples = new Map(
    (Array.isArray(progressDoc?.focus?.items) ? progressDoc.focus.items : [])
      .map((i) => [i.concept, Array.isArray(i.examples) ? i.examples : []])
  );

  return {
    at: Number(review.at) || 0,
    fromAt: Number(review.fromAt) || 0,
    items: items.map((i) => ({
      id: i.concept,
      label: conceptLabel(i.concept, lang),
      before: { attempts: Number(i?.before?.attempts) || 0, errors: Number(i?.before?.errors) || 0 },
      after: { attempts: Number(i?.after?.attempts) || 0, errors: Number(i?.after?.errors) || 0 },
      verdict: i.verdict,
      examples: examples.get(i.concept) || [],
    })),
  };
}

// What the next session will be measured on. Shown on its own only when there
// is no review yet (the first analysed session), so the learner knows what is
// being watched before it is judged.
export function currentFocus(progressDoc, lang = getFeedbackLanguage()) {
  const items = Array.isArray(progressDoc?.focus?.items) ? progressDoc.focus.items : [];
  return items.map((i) => ({
    id: i.concept,
    label: conceptLabel(i.concept, lang),
    attempts: Number(i.attempts) || 0,
    errors: Number(i.errors) || 0,
    examples: Array.isArray(i.examples) ? i.examples : [],
  }));
}

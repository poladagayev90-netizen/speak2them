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

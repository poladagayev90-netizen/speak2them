// The analysis document changed shape (grammarFixes/encouragement/fluencyScore
// -> feedback/recap/scores). Analyses saved before that are still in Firestore
// and must keep rendering, so both readers go through this one adapter instead
// of scattering fallbacks across the UI.

const arr = (v) => (Array.isArray(v) ? v : []);

export function toAnalysisView(analysis) {
  if (!analysis) return null;

  const scores = analysis.scores || {};
  // Old docs only ever had a fluency score; leave the others undefined so the
  // UI can hide those tiles rather than print a misleading 0.
  const fluency = Number.isFinite(scores.fluency) ? scores.fluency
    : (Number.isFinite(analysis.fluencyScore) ? analysis.fluencyScore : undefined);

  const feedback = analysis.feedback
    ? arr(analysis.feedback)
    : arr(analysis.grammarFixes).map((f) => ({
      original: f.original,
      corrected: f.corrected,
      reason: f.reason || f.why || f.explanation,
    }));

  const vocabulary = analysis.vocabulary
    ? arr(analysis.vocabulary)
    // Old suggestions carried an Azerbaijani meaning where the example now goes.
    : arr(analysis.vocabularySuggestions).map((v) => ({ word: v.word, example: v.meaning }));

  return {
    recap: analysis.recap || analysis.encouragement || '',
    overallScore: Number.isFinite(analysis.overallScore) ? analysis.overallScore : 0,
    scores: {
      fluency,
      grammar: Number.isFinite(scores.grammar) ? scores.grammar : undefined,
      vocabulary: Number.isFinite(scores.vocabulary) ? scores.vocabulary : undefined,
    },
    feedback: feedback.filter((f) => f && f.original && f.corrected),
    strengths: arr(analysis.strengths),
    tips: arr(analysis.tips),
    vocabulary: vocabulary.filter((v) => v && v.word),
    speakingPace: analysis.speakingPace,
    transcript: analysis.transcript,
    // Fields only old documents have; the UI shows them when present.
    legacyVocabularyUsed: arr(analysis.vocabularyUsed),
    legacyExamples: arr(analysis.exampleSentences),
  };
}

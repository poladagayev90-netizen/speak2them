// The analysis document changed shape (grammarFixes/encouragement/fluencyScore
// -> feedback/recap/scores). Analyses saved before that are still in Firestore
// and must keep rendering, so both readers go through this one adapter instead
// of scattering fallbacks across the UI.

const arr = (v) => (Array.isArray(v) ? v : []);

// Worker errors are internal strings ("recording-missing: callRecordings/<uid>/…",
// "Groq LLM error 500: …"). Never show them raw: they are noise at best and leak
// storage paths at worst.
export function analysisErrorMessage(error) {
  const text = String(error || '');
  if (text.startsWith('no-speech')) {
    return 'No speech was picked up — the call may have been very short, or the microphone was off.';
  }
  if (text.startsWith('recording-missing')) {
    return 'The recording was not found — the upload may not have finished.';
  }
  return 'A technical problem occurred. The team has been notified.';
}

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

  // `cefr` and `meaning` exist only on analyses from 2026-10-01 on; older
  // words render with the word and example alone.
  const vocabulary = analysis.vocabulary
    ? arr(analysis.vocabulary)
    // Old suggestions carried an Azerbaijani meaning where the example now goes.
    : arr(analysis.vocabularySuggestions).map((v) => ({ word: v.word, example: v.meaning }));

  // Yeni "elite" analiz sahələri — köhnə sənədlərdə yoxdur, UI şərti göstərir.
  const hw = analysis.homework && typeof analysis.homework === 'object' ? analysis.homework : null;
  const homework = hw ? {
    multipleChoice: arr(hw.multiple_choice).filter(
      (q) => q && q.question && Array.isArray(q.options) && q.options.includes(q.correct_answer)
    ),
    wordOrder: arr(hw.word_order).filter(
      (w) => w && w.correct_sentence && Array.isArray(w.scrambled) && w.scrambled.length >= 2
    ),
    correction: arr(hw.correction).filter((f) => f && f.original && f.corrected),
  } : null;

  // Mövzu qrupları (yeni analizlər). Köhnə sənədlərdə yoxdur — o halda UI
  // düz `feedback` cədvəlinə qayıdır.
  //
  // An item with no quote but a neutral pair is a mistake the model found only
  // in a private sentence (functions/index.js, PRIVATE TOPICS): it shows as the
  // general example, marked `generic`. The teacher's copy
  // (callAnalysisTeacher, `teacherView`) holds only such items, and a report
  // from before the split none at all — there the theme still shows, as a
  // mistake type with its count.
  const teacherView = analysis.teacherView === true;
  const errorThemes = arr(analysis.errorThemes)
    .map((t) => ({
      title: t?.title || '',
      rule: t?.rule || '',
      count: Number(t?.count) || arr(t?.items).length,
      items: arr(t?.items)
        .map((i) => {
          if (!i) return null;
          if (i.original && i.corrected) return i;
          const n = i.neutralExample;
          return n && n.original && n.corrected
            ? { ...i, original: n.original, corrected: n.corrected, generic: true }
            : null;
        })
        .filter(Boolean),
    }))
    .filter((t) => t.title && (t.items.length > 0 || teacherView));

  // Bu sessiyanın konsept kəsiyi ({concept, attempts, errors}). Aqreqat
  // users/{uid}/insights/grammar-dadır — bu sahə yalnız "bu zəngdə nə oldu"
  // sualına cavab verir. Köhnə analizlərdə yoxdur, UI şərti göstərir.
  const conceptStats = arr(analysis.conceptStats)
    .filter((c) => c && typeof c.concept === 'string' && Number(c.attempts) > 0)
    .map((c) => ({
      concept: c.concept,
      attempts: Number(c.attempts) || 0,
      errors: Number(c.errors) || 0,
    }));

  return {
    teacherView,
    errorThemes,
    conceptStats,
    reportMarkdown: typeof analysis.reportMarkdown === 'string' ? analysis.reportMarkdown : '',
    homework: homework && (homework.multipleChoice.length || homework.wordOrder.length || homework.correction.length)
      ? homework
      : null,
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
    // Only reports Gemini wrote (it hears the voice — functions/geminiAnalysis.js).
    // Older and text-only reports have none of these, and the UI skips them.
    pronunciation: arr(analysis.pronunciation).filter((p) => p && p.word && p.heard && p.tip),
    delivery: analysis.delivery && typeof analysis.delivery === 'object'
      ? {
        fillers: arr(analysis.delivery.fillers).filter((f) => f && f.word && Number(f.count) > 0),
        hesitation: arr(analysis.delivery.hesitation).filter((h) => typeof h === 'string' && h),
        smoothest: typeof analysis.delivery.smoothest === 'string' ? analysis.delivery.smoothest : '',
        intonation: typeof analysis.delivery.intonation === 'string' ? analysis.delivery.intonation : '',
      }
      : null,
    bestMoment: analysis.bestMoment && analysis.bestMoment.quote ? analysis.bestMoment : null,
    // Fields only old documents have; the UI shows them when present.
    legacyVocabularyUsed: arr(analysis.vocabularyUsed),
    legacyExamples: arr(analysis.exampleSentences),
  };
}

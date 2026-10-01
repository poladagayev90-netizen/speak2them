// The personal half of a class homework. The topic half (words, dictation,
// later the story chapter) is the same for the whole class; this half comes
// from the learner's OWN call analyses since the previous lesson: the words
// the report picked out for them, the mistake patterns they repeated, and the
// exercises the report already wrote from those mistakes. Nothing is invented
// — a learner with no analyses gets an empty personal half and the page shows
// only the topic steps.
//
// Input: callAnalysis docs (as stored: errorThemes, vocabulary, homework),
// newest first. Output is small enough to sit on the homework doc.

const MAX_WORDS = 8;
const MAX_THEMES = 2;
const MAX_EXAMPLES = 3;
const MAX_MC = 5;
const MAX_ORDER = 3;

const str = (v, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : "");

function buildPersonal(analyses = []) {
  const done = analyses.filter((a) => a && a.status === "done");

  // Words: newest report first, one entry per word.
  const words = [];
  const seen = new Set();
  for (const a of done) {
    for (const v of Array.isArray(a.vocabulary) ? a.vocabulary : []) {
      const word = str(v && v.word, 60);
      const key = word.toLowerCase();
      if (!word || seen.has(key)) continue;
      seen.add(key);
      words.push({ word, meaning: str(v.meaning, 160), example: str(v.example, 200), cefr: str(v.cefr, 2) });
      if (words.length >= MAX_WORDS) break;
    }
    if (words.length >= MAX_WORDS) break;
  }

  // Themes: the patterns that came back most often across the reports. A theme
  // is keyed by its grammar concept (the taxonomy id), so "articles" in two
  // reports with different titles still counts twice.
  const byConcept = new Map();
  for (const a of done) {
    for (const t of Array.isArray(a.errorThemes) ? a.errorThemes : []) {
      const items = Array.isArray(t && t.items) ? t.items : [];
      const concept = str(items[0] && items[0].concept, 60) || str(t && t.title, 60).toLowerCase();
      if (!concept) continue;
      const cur = byConcept.get(concept) || { concept, title: str(t.title, 120), rule: str(t.rule, 300), count: 0, examples: [] };
      cur.count += items.length || 1;
      for (const it of items) {
        if (cur.examples.length >= MAX_EXAMPLES) break;
        const original = str(it && it.original, 200);
        const corrected = str(it && it.corrected, 200);
        if (original && corrected && !cur.examples.some((e) => e.original === original)) {
          cur.examples.push({ original, corrected });
        }
      }
      byConcept.set(concept, cur);
    }
  }
  const themes = [...byConcept.values()]
    .sort((x, y) => y.count - x.count)
    .slice(0, MAX_THEMES)
    .map(({ concept, title, rule, examples }) => ({ concept, title, rule, examples }));

  // Exercises the reports already wrote from these mistakes.
  const multipleChoice = [];
  const wordOrder = [];
  for (const a of done) {
    const hw = (a && a.homework) || {};
    for (const q of Array.isArray(hw.multiple_choice) ? hw.multiple_choice : []) {
      if (multipleChoice.length >= MAX_MC) break;
      const options = Array.isArray(q.options) ? q.options.map((o) => str(o, 120)).filter(Boolean) : [];
      const answer = str(q.correct_answer, 120);
      if (str(q.question) && options.length >= 2 && options.includes(answer)) {
        multipleChoice.push({ question: str(q.question), options, answer, explanation: str(q.explanation) });
      }
    }
    for (const w of Array.isArray(hw.word_order) ? hw.word_order : []) {
      if (wordOrder.length >= MAX_ORDER) break;
      const scrambled = Array.isArray(w.scrambled) ? w.scrambled.map((x) => str(x, 40)).filter(Boolean) : [];
      if (scrambled.length >= 2 && str(w.correct_sentence)) {
        wordOrder.push({ scrambled, sentence: str(w.correct_sentence), explanation: str(w.explanation) });
      }
    }
  }

  return { sessions: done.length, words, themes, multipleChoice, wordOrder };
}

function hasPersonal(p) {
  return !!p && (p.words.length + p.themes.length + p.multipleChoice.length + p.wordOrder.length) > 0;
}

module.exports = { buildPersonal, hasPersonal };

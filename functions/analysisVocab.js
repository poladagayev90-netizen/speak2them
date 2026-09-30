// The "words to reuse" list of an analysis report, as stored on callAnalysis.
//
// Pure, so the shape is tested without a model call. From 2026-10-01 each
// word also carries its CEFR level and a short meaning in the report language
// (the Lab's Vocabulary tab shows both); a model that leaves either out, or
// invents a level outside A1–C2, costs the word its extra — never the word.

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const MAX_WORDS = 4;

const str = (v) => (typeof v === "string" ? v.trim() : "");

function normalizeVocabulary(list) {
  return (Array.isArray(list) ? list : [])
    .map((v) => {
      const word = str(v?.word);
      const example = str(v?.example);
      const cefr = str(v?.cefr).toUpperCase();
      const meaning = str(v?.meaning).slice(0, 160);
      return {
        word,
        example,
        ...(CEFR.includes(cefr) ? { cefr } : {}),
        ...(meaning ? { meaning } : {}),
      };
    })
    .filter((v) => v.word)
    .slice(0, MAX_WORDS);
}

module.exports = { normalizeVocabulary, CEFR };

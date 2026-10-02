// The teacher's class brief before a lesson: what the CLASS keeps getting
// wrong, the words the class kept reaching for, and who did the last homework.
// Built from the members' own call analyses since the last held lesson — the
// same window the personal homework uses (homeworkBuilder.js) — so the brief
// and the homework talk about the same calls. Pure; teacherClassBrief in
// index.js loads the data. No AI: every line is counted, nothing is guessed.

const { GRAMMAR_CONCEPTS } = require("./grammarConcepts");

const LABEL = new Map(GRAMMAR_CONCEPTS.map((c) => [c.id, c.en]));
const MAX_THEMES = 3;
const MAX_WORDS = 10;
const MAX_EXAMPLES = 2;

// Same rule as src/utils/cohortLessons.js homeworkStepKeys — keep in step.
function homeworkStepKeys(personal, story) {
  const p = personal || {};
  const mine = ["words", "themes", "multipleChoice", "wordOrder"].some((k) => Array.isArray(p[k]) && p[k].length > 0);
  return [...(story ? ["listening"] : []), "words", ...(story ? ["reading"] : []), "dictation", ...(mine ? ["mine"] : []), "speak"];
}

// A shared pattern is shown through DIFFERENT learners first — two lines
// from the same person would hide that it is a class problem.
function pickExamples(all) {
  const out = [];
  const seen = new Set();
  for (const e of all) if (out.length < MAX_EXAMPLES && !seen.has(e.uid)) { out.push(e); seen.add(e.uid); }
  for (const e of all) if (out.length < MAX_EXAMPLES && !out.includes(e)) out.push(e);
  return out.map(({ name, original, corrected }) => ({ name, original, corrected }));
}

// members: [{ uid, name, analyses: [callAnalysis docs], homework: homework doc | null }]
function buildClassBrief(members) {
  const themes = new Map(); // concept -> { students:Set, mistakes, examples }
  const words = new Map(); // lower word -> { word, students:Set }

  const students = members.map((m) => {
    const done = (m.analyses || []).filter((a) => a && a.status === "done");
    for (const a of done) {
      for (const t of Array.isArray(a.errorThemes) ? a.errorThemes : []) {
        for (const it of Array.isArray(t && t.items) ? t.items : []) {
          const concept = it && it.concept;
          if (!LABEL.has(concept)) continue;
          const cur = themes.get(concept) || { concept, students: new Set(), mistakes: 0, examples: [] };
          cur.students.add(m.uid);
          cur.mistakes += 1;
          if (it.original && it.corrected && !cur.examples.some((e) => e.original === it.original)) {
            cur.examples.push({ uid: m.uid, name: m.name, original: String(it.original).slice(0, 200), corrected: String(it.corrected).slice(0, 200) });
          }
          themes.set(concept, cur);
        }
      }
      for (const v of Array.isArray(a.vocabulary) ? a.vocabulary : []) {
        const w = v && typeof v.word === "string" ? v.word.trim() : "";
        if (!w) continue;
        const key = w.toLowerCase();
        const cur = words.get(key) || { word: w, students: new Set() };
        cur.students.add(m.uid);
        words.set(key, cur);
      }
    }

    const hw = m.homework;
    let homework = null;
    if (hw && !hw.hidden) {
      const keys = homeworkStepKeys(hw.personal, hw.story === true);
      const doneSteps = (hw.doneSteps || []).filter((k) => keys.includes(k));
      homework = {
        n: hw.n,
        done: doneSteps.length,
        total: keys.length,
        dictation: hw.scores && Number.isFinite(hw.scores.dictation) ? hw.scores.dictation : null,
      };
    }
    return { uid: m.uid, name: m.name || "Student", calls: done.length, homework };
  });

  // A pattern shared by more people beats one person's many slips.
  const topThemes = [...themes.values()]
    .sort((a, b) => b.students.size - a.students.size || b.mistakes - a.mistakes)
    .slice(0, MAX_THEMES)
    .map((t) => ({ concept: t.concept, label: LABEL.get(t.concept), students: t.students.size, mistakes: t.mistakes, examples: pickExamples(t.examples) }));

  const topWords = [...words.values()]
    .sort((a, b) => b.students.size - a.students.size || a.word.localeCompare(b.word))
    .slice(0, MAX_WORDS)
    .map((w) => ({ word: w.word, students: w.students.size }));

  students.sort((a, b) => {
    const pa = a.homework ? a.homework.done / a.homework.total : -1;
    const pb = b.homework ? b.homework.done / b.homework.total : -1;
    return pa - pb || a.name.localeCompare(b.name);
  });

  const withCalls = students.filter((s) => s.calls > 0).length;
  const focus = topThemes.length && topThemes[0].students >= 2
    ? `${topThemes[0].students} of ${members.length} learners mixed up ${topThemes[0].label.toLowerCase()} — worth a few minutes in the next lesson.`
    : topThemes.length
      ? `Only one learner shows a pattern so far (${topThemes[0].label.toLowerCase()}); a quick word with them may be enough.`
      : withCalls
        ? "No repeated mistakes in the class's calls since the last lesson."
        : "Nobody in the class has an analysed call since the last lesson yet.";

  return {
    members: members.length,
    withCalls,
    focus,
    themes: topThemes,
    words: topWords,
    students,
  };
}

module.exports = { buildClassBrief, homeworkStepKeys };

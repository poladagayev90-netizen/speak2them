const test = require("node:test");
const assert = require("node:assert");
const { buildClassBrief, homeworkStepKeys } = require("./classBrief");
const { GRAMMAR_CONCEPTS } = require("./grammarConcepts");

const [A, B] = GRAMMAR_CONCEPTS.map((c) => c.id);
const err = (concept, original = "x", corrected = "y") => ({ title: "t", rule: "r", items: [{ original, corrected, explanation: "", concept }] });
const call = (themes = [], vocabulary = []) => ({ status: "done", errorThemes: themes, vocabulary });

test("a pattern shared by more learners comes first", () => {
  const brief = buildClassBrief([
    { uid: "1", name: "Yunus", analyses: [call([err(B), err(B), err(B)])] },
    { uid: "2", name: "Sabina", analyses: [call([err(A, "I go yesterday", "I went yesterday")])] },
    { uid: "3", name: "Nisa", analyses: [call([err(A)])] },
  ]);
  assert.strictEqual(brief.themes[0].concept, A);
  assert.strictEqual(brief.themes[0].students, 2);
  assert.strictEqual(brief.themes[1].mistakes, 3);
  assert.deepStrictEqual(brief.themes[0].examples[0], { name: "Sabina", original: "I go yesterday", corrected: "I went yesterday" });
  assert.match(brief.focus, /^2 of 3 learners mixed up/);
});

test("unknown concepts and unfinished reports are ignored", () => {
  const brief = buildClassBrief([
    { uid: "1", name: "Y", analyses: [call([err("not_a_concept")]), { ...call([err(A)]), status: "processing" }] },
  ]);
  assert.deepStrictEqual(brief.themes, []);
  assert.strictEqual(brief.withCalls, 1); // the finished call still counts as a call
  assert.match(brief.focus, /No repeated mistakes/);
  assert.match(buildClassBrief([{ uid: "2", name: "Z", analyses: [] }]).focus, /Nobody/);
});

test("words count learners, not mentions", () => {
  const brief = buildClassBrief([
    { uid: "1", name: "Y", analyses: [call([], [{ word: "Figure out" }]), call([], [{ word: "figure out" }])] },
    { uid: "2", name: "S", analyses: [call([], [{ word: "figure out" }, { word: "layover" }])] },
  ]);
  assert.deepStrictEqual(brief.words[0], { word: "Figure out", students: 2 });
  assert.strictEqual(brief.words[1].students, 1);
});

test("homework progress uses the same steps as the app; least done first", () => {
  const brief = buildClassBrief([
    { uid: "1", name: "Done", analyses: [], homework: { n: 2, doneSteps: ["words", "dictation", "speak"], scores: { dictation: 80 } } },
    { uid: "2", name: "None", analyses: [], homework: null },
    { uid: "3", name: "Half", analyses: [], homework: { n: 2, doneSteps: ["words"] } },
  ]);
  assert.deepStrictEqual(brief.students.map((s) => s.name), ["None", "Half", "Done"]);
  assert.deepStrictEqual(brief.students[2].homework, { n: 2, done: 3, total: 3, dictation: 80 });
  assert.deepStrictEqual(brief.students[1].homework, { n: 2, done: 1, total: 3, dictation: null });
});

test("step keys match the client", () => {
  assert.deepStrictEqual(homeworkStepKeys(null), ["words", "dictation", "speak"]);
  assert.deepStrictEqual(homeworkStepKeys({ words: [1] }), ["words", "dictation", "mine", "speak"]);
});

test("examples come from different learners first", () => {
  const brief = buildClassBrief([
    { uid: "1", name: "Yunus", analyses: [call([err(A, "a1", "b1"), err(A, "a2", "b2")])] },
    { uid: "2", name: "Sabina", analyses: [call([err(A, "a3", "b3")])] },
  ]);
  assert.deepStrictEqual(brief.themes[0].examples.map((e) => e.name), ["Yunus", "Sabina"]);
});

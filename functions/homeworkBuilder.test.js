const test = require("node:test");
const assert = require("node:assert");
const { buildPersonal, hasPersonal } = require("./homeworkBuilder");

const report = (over = {}) => ({
  status: "done",
  vocabulary: [{ word: "figure out", meaning: "həll etmək", example: "I can figure it out.", cefr: "B1" }],
  errorThemes: [{
    title: "Articles", rule: "Use a/an before a singular noun.",
    items: [{ original: "I have car", corrected: "I have a car", explanation: "", concept: "articles" }],
  }],
  homework: {
    multiple_choice: [{ question: "I have ___ car.", options: ["a", "an", "the"], correct_answer: "a", explanation: "" }],
    word_order: [{ scrambled: ["car", "a", "I", "have"], correct_sentence: "I have a car", explanation: "" }],
  },
  ...over,
});

test("a learner with no reports gets an empty personal half", () => {
  const p = buildPersonal([]);
  assert.deepStrictEqual(p, { sessions: 0, words: [], themes: [], multipleChoice: [], wordOrder: [] });
  assert.strictEqual(hasPersonal(p), false);
});

test("unfinished reports are ignored", () => {
  assert.strictEqual(buildPersonal([report({ status: "processing" })]).sessions, 0);
});

test("words are deduplicated, newest report first", () => {
  const p = buildPersonal([
    report({ vocabulary: [{ word: "Figure out", meaning: "new", example: "", cefr: "B1" }] }),
    report(),
  ]);
  assert.strictEqual(p.words.length, 1);
  assert.strictEqual(p.words[0].meaning, "new");
});

test("the most repeated pattern comes first, counted by concept", () => {
  const tense = { title: "Past tense", rule: "Use the past for finished time.",
    items: [{ original: "Yesterday I go", corrected: "Yesterday I went", explanation: "", concept: "past_simple" }] };
  const p = buildPersonal([
    report({ errorThemes: [tense] }),
    report({ errorThemes: [{ ...tense, title: "Verbs in the past" }] }),
    report(),
  ]);
  assert.strictEqual(p.themes[0].concept, "past_simple");
  assert.strictEqual(p.themes[0].examples.length, 1); // same sentence twice is kept once
  assert.strictEqual(p.themes[1].concept, "articles");
});

test("a question whose answer is not among its options is dropped", () => {
  const p = buildPersonal([report({ homework: {
    multiple_choice: [{ question: "Q", options: ["x", "y", "z"], correct_answer: "w", explanation: "" }],
    word_order: [],
  } })]);
  assert.strictEqual(p.multipleChoice.length, 0);
  assert.strictEqual(hasPersonal(p), true); // words and themes remain
});

test("caps keep the doc small", () => {
  const many = Array.from({ length: 12 }, (_, i) => report({
    vocabulary: [{ word: `w${i}`, meaning: "", example: "", cefr: "A2" }],
  }));
  const p = buildPersonal(many);
  assert.strictEqual(p.words.length, 8);
  assert.strictEqual(p.multipleChoice.length, 5);
  assert.strictEqual(p.wordOrder.length, 3);
});

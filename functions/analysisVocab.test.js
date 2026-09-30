const test = require("node:test");
const assert = require("node:assert");
const { normalizeVocabulary } = require("./analysisVocab");

test("keeps a valid level and meaning", () => {
  assert.deepStrictEqual(
    normalizeVocabulary([{ word: " salary ", example: "My salary is fine.", cefr: "b1", meaning: "maaş" }]),
    [{ word: "salary", example: "My salary is fine.", cefr: "B1", meaning: "maaş" }],
  );
});

test("an invented level or empty meaning drops only that field", () => {
  assert.deepStrictEqual(
    normalizeVocabulary([{ word: "give up", example: "x", cefr: "B3", meaning: "" }]),
    [{ word: "give up", example: "x" }],
  );
});

test("old reports (word + example) and junk still normalise", () => {
  assert.deepStrictEqual(normalizeVocabulary([{ word: "a", example: "b" }, { example: "no word" }, null]), [{ word: "a", example: "b" }]);
  assert.deepStrictEqual(normalizeVocabulary(undefined), []);
  assert.strictEqual(normalizeVocabulary([1, 2, 3, 4, 5].map((i) => ({ word: `w${i}` }))).length, 4);
});

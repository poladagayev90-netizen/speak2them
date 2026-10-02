const test = require("node:test");
const assert = require("node:assert");
const { buildChapterPrompt, normalizeChapter, longEnough, splitForTts, seasonOf } = require("./storyChapter");

const words = (k) => Array.from({ length: k }, (_, i) => `word${i}`).join(" ");

const good = () => ({
  title: "The window",
  summary: "Julian broke the window. He told Sterling the truth.",
  listening: { kind: "voicemail", text: words(60) },
  reading: `Julian had to face the music. ${words(200)}`,
  expressions: [
    { phrase: "face the music", meaning_az: "nəticə ilə üzləşmək", meaning_tr: "sonuçlarla yüzleşmek", example: "He faced the music." },
    { phrase: "not in the text", meaning_az: "x", meaning_tr: "x", example: "x" },
  ],
  questions: [
    { question: "What broke?", options: ["A window", "A door", "A cup"], answer: "A window" },
    { question: "Bad", options: ["a", "b"], answer: "c" },
  ],
  dictation: ["Julian had to face the music.", "Too short", "This sentence is far too long to be a fair dictation line for anyone at all, even a very patient one."],
  dilemma: { question: "Should Julian blame the storm?", sideA: "No one would know.", sideB: "Lies grow." },
});

test("the prompt carries the beat, the topic and what the class already read", () => {
  const p = buildChapterPrompt({ n: 2, level: "A2", topic: { title: "Travel", words: [{ word: "layover", meaning: "aralıq dayanacaq" }] },
    previous: [{ n: 1, title: "The window", summary: "Julian broke the window." }] });
  assert.match(p, /EPISODE 2: "The envelope"/);
  assert.match(p, /LESSON TOPIC \(the scene of this episode\): Travel/);
  assert.match(p, /Episode 1 — The window: Julian broke the window\./);
  assert.match(p, /Should Julian blame the storm\?/); // the previous dilemma, revealed in the listening
  assert.match(p, /LEVEL A2: reading 240-300 words/);
});

test("the first episode has no previous dilemma to reveal", () => {
  const p = buildChapterPrompt({ n: 1, level: "B1", topic: { title: "Music", words: [] } });
  assert.match(p, /introduces Julian/);
});

test("expressions must appear in the reading; bad questions and dictation lines are dropped", () => {
  const c = normalizeChapter(good(), { n: 1, level: "A2" });
  assert.deepStrictEqual(c.expressions.map((e) => e.phrase), ["face the music"]);
  assert.strictEqual(c.expressions[0].meaningAZ, "nəticə ilə üzləşmək");
  assert.strictEqual(c.questions.length, 1);
  assert.deepStrictEqual(c.dictation, ["Julian had to face the music."]);
  assert.strictEqual(c.beat, "The window");
});

test("half an episode is refused", () => {
  assert.throws(() => normalizeChapter({ ...good(), reading: "Too short." }, { n: 1, level: "A2" }), /chapter_incomplete/);
  assert.throws(() => normalizeChapter({ ...good(), dilemma: {} }, { n: 1, level: "A2" }), /chapter_incomplete/);
});

test("long text is split at sentence ends under the TTS limit", () => {
  const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
  const parts = splitForTts(text, 200);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 200));
  assert.strictEqual(parts.join(" "), text);
});

test("seasons follow the lesson number", () => {
  assert.strictEqual(seasonOf(1).n, 1);
  assert.strictEqual(seasonOf(16).n, 2);
  assert.strictEqual(seasonOf(60).n, 4);
});

test("a draft well under its level's length is not long enough", () => {
  const c = normalizeChapter(good(), { n: 1, level: "A2" });
  assert.strictEqual(c.words, 206);
  assert.strictEqual(longEnough(c), true); // A2 floor: 85% of 240 = 204
  assert.strictEqual(longEnough({ ...c, level: "B1" }), false); // B1 floor: 289
});

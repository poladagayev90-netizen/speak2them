import { markDictation, markOriginal, normalizeWords } from './dictation';

test('case, punctuation and contractions do not count', () => {
  expect(normalizeWords("I'm late, Mr. Sterling!")).toEqual(['i', 'am', 'late', 'mr', 'sterling']);
  expect(markDictation("I'm late.", 'i am late').score).toBe(100);
});

test('one missed word marks only that word', () => {
  const r = markDictation('He made a serious mistake', 'He made serious mistake');
  expect(r.words.map((w) => w.ok)).toEqual([true, true, false, true, true]);
  expect(r.score).toBe(80);
});

test('a wrong word counts as missed and as extra', () => {
  const r = markDictation('She broke the window', 'She broke the windows');
  expect(r.words[3]).toEqual({ word: 'window', ok: false });
  expect(r.score).toBe(63);
});

test('typing nothing scores zero; extra words cannot push past the sentence', () => {
  expect(markDictation('Hello there', '').score).toBe(0);
  expect(markDictation('Hello', 'hello hello hello hello').score).toBe(0);
});

test('the written sentence keeps its capitals and punctuation', () => {
  const target = "We had a 4-hour layover in Istanbul.";
  const marked = markOriginal(target, markDictation(target, 'we had a layover in istanbul'));
  expect(marked.map((t) => t.text).join(' ')).toBe(target);
  expect(marked.filter((t) => !t.ok).map((t) => t.text)).toEqual(['4-hour']);
  const m2 = markOriginal("I'm late", markDictation("I'm late", 'I late'));
  expect(m2[0]).toEqual({ text: "I'm", ok: false });
});

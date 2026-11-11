const test = require('node:test');
const assert = require('node:assert');
const p = require('./analysisPrivacy');

const PRIVATE = 'My sister borrowed money from me and she not give it back';

// A report as the worker stores it (callAnalysis/{id}), with a private
// sentence quoted as the mistake example.
const report = (privacyVersion) => ({
  privacyVersion,
  userId: 'stu1',
  status: 'done',
  overallScore: 71,
  scores: { fluency: 70, grammar: 65, vocabulary: 78 },
  speakingPace: { wpm: 104, words: 900 },
  durationSeconds: 600,
  transcript: `Hello. ${PRIVATE}. I am live in Baku with Leyla.`,
  recap: 'You talked about your sister and the money.',
  reportMarkdown: '## Hi!\nYou told me about your sister.',
  strengths: ['You said "she borrowed money" clearly.'],
  tips: ['Shadow it'],
  bestMoment: { quote: PRIVATE, why: 'good' },
  delivery: { fillers: [{ word: 'um', count: 4 }], hesitation: ['"my sister..."'], smoothest: 'x', intonation: '' },
  vocabulary: [{ word: 'borrow', example: PRIVATE }],
  homework: { word_order: [{ correct_sentence: 'She did not give it back' }] },
  pronunciation: [{ word: 'Leyla', heard: 'lay-la', should: 'LAY-la', tip: 't', times: 1 }],
  conceptStats: [{ concept: 'past_simple', attempts: 6, errors: 1 }],
  errorThemes: [{
    title: 'Past simple negatives',
    rule: 'did not + base verb',
    items: [{
      original: PRIVATE,
      corrected: 'My sister borrowed money from me and she did not give it back',
      reason: 'Your sister...',
      concept: 'past_simple',
      neutralExample: { original: 'He not finish the book yesterday.', corrected: 'He did not finish the book yesterday.' },
    }],
  }],
});

const allText = (o) => JSON.stringify(o);

test('teacher projection carries no raw quote, transcript or prose', () => {
  const t = p.teacherAnalysis(report(1));
  const s = allText(t);
  assert.ok(!s.includes('sister'), 'private sentence leaked');
  assert.ok(!s.includes('Baku'), 'transcript leaked');
  for (const k of ['transcript', 'recap', 'reportMarkdown', 'strengths', 'tips', 'bestMoment', 'delivery', 'vocabulary', 'homework', 'peerName']) {
    assert.ok(!(k in t), `${k} must not be in the teacher view`);
  }
  assert.deepStrictEqual(p.rawQuotes(t), []);
});

test('teacher projection keeps the mistake type and the neutral example', () => {
  const t = p.teacherAnalysis(report(1));
  assert.strictEqual(t.teacherView, true);
  assert.strictEqual(t.overallScore, 71);
  assert.deepStrictEqual(t.speakingPace, { wpm: 104 });
  const theme = t.errorThemes[0];
  assert.strictEqual(theme.title, 'Past simple negatives');
  assert.strictEqual(theme.rule, 'did not + base verb');
  assert.strictEqual(theme.count, 1);
  assert.deepStrictEqual(theme.concepts, ['past_simple']);
  assert.deepStrictEqual(theme.items, [{
    original: 'He not finish the book yesterday.',
    corrected: 'He did not finish the book yesterday.',
    concept: 'past_simple',
    generic: true,
  }]);
});

test('an old report falls back to the pattern only: no quote, no rule, no example', () => {
  const old = report(undefined);
  delete old.errorThemes[0].items[0].neutralExample;
  const t = p.teacherAnalysis(old);
  assert.ok(!allText(t).includes('sister'));
  assert.strictEqual(t.privacyVersion, 0);
  assert.deepStrictEqual(t.errorThemes, [{ title: 'Past simple negatives', rule: '', count: 1, concepts: ['past_simple'], items: [] }]);
  assert.ok(!('pronunciation' in t), 'old pronunciation may name a person');
});

test('an old report never shows a neutral pair it did not promise', () => {
  // Even if an item somehow carried a neutral pair, a report without the
  // privacy version was not written under the filter.
  const t = p.teacherAnalysis(report(0));
  assert.deepStrictEqual(t.errorThemes[0].items, []);
});

test('teacher progress swaps carry-over examples for neutral ones', () => {
  const progress = {
    wordCount: 300,
    lastNewWords: 12,
    series: [{ at: 1, overall: 70 }],
    focus: {
      at: 1,
      items: [
        { concept: 'past_simple', attempts: 6, errors: 1, examples: [{ original: PRIVATE, corrected: 'x', neutralExample: { original: 'He not go.', corrected: 'He did not go.' } }] },
        { concept: 'articles', attempts: 3, errors: 1, examples: [{ original: 'I live in the Baku with Leyla', corrected: 'I live in Baku with Leyla' }] },
      ],
    },
    focusReview: { items: [{ concept: 'articles', verdict: 'better' }] },
  };
  const t = p.teacherProgress(progress);
  const s = allText(t);
  assert.ok(!s.includes('sister') && !s.includes('Leyla'));
  assert.deepStrictEqual(t.focus.items[0].examples, [{ original: 'He not go.', corrected: 'He did not go.' }]);
  assert.deepStrictEqual(t.focus.items[1].examples, []);
  assert.strictEqual(t.wordCount, 300);
  assert.deepStrictEqual(t.focusReview, progress.focusReview);
});

test('neutralFrom rejects a "neutral" sentence that repeats the learner', () => {
  assert.strictEqual(p.neutralFrom({ neutral_original: PRIVATE, neutral_corrected: 'My sister borrowed money from me and she did not give it back' }, PRIVATE), null);
  assert.strictEqual(p.neutralFrom({ neutral_original: 'She go home.', neutral_corrected: 'She go home.' }, PRIVATE), null);
  assert.strictEqual(p.neutralFrom({ neutral_original: '', neutral_corrected: 'x' }, PRIVATE), null);
  assert.deepStrictEqual(
    p.neutralFrom({ neutral_original: ' He not finish the book. ', neutral_corrected: 'He did not finish the book.' }, PRIVATE),
    { original: 'He not finish the book.', corrected: 'He did not finish the book.' },
  );
});

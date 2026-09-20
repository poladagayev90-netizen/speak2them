const test = require('node:test');
const assert = require('node:assert/strict');
const { seriesConcepts, reviewFocus, nextFocus, verdictFor } = require('./learningFocus');

const stats = (...rows) => rows.map(([concept, attempts, errors]) => ({ concept, attempts, errors }));
const themes = [{
  title: 'Articles',
  items: [
    { concept: 'articles', original: 'I go to the school', corrected: 'I go to school' },
    { concept: 'articles', original: 'she is teacher', corrected: 'she is a teacher' },
    { concept: 'articles', original: 'a apple', corrected: 'an apple' },
    { concept: 'past_simple', original: 'I go yesterday', corrected: 'I went yesterday' },
  ],
}];

test('the focus keeps the worst concepts with the learner own sentences', () => {
  const focus = nextFocus(stats(['articles', 12, 4], ['past_simple', 6, 1], ['modals', 5, 0]), themes, null, { at: 1 });
  assert.deepEqual(focus.items.map((i) => i.concept), ['articles', 'past_simple']); // errors:0 is not a focus
  assert.equal(focus.items[0].examples.length, 2); // capped, so the card stays a card
  assert.equal(focus.items[0].examples[0].corrected, 'I go to school');
});

test('a clean session keeps the previous focus instead of erasing what we track', () => {
  const prev = { at: 1, items: [{ concept: 'articles', attempts: 12, errors: 4, examples: [] }] };
  assert.equal(nextFocus(stats(['modals', 9, 0]), [], prev, { at: 2 }), prev);
  assert.equal(nextFocus([], [], null, { at: 2 }), null);
});

test('a verdict is refused when the concept barely came up', () => {
  assert.equal(verdictFor({ attempts: 12, errors: 4 }, { attempts: 2, errors: 0 }), 'unseen');
  assert.equal(verdictFor({ attempts: 12, errors: 4 }, { attempts: 8, errors: 0 }), 'clean');
});

test('the verdict compares rates, not counts, so a longer session is not punished', () => {
  const before = { attempts: 10, errors: 5 };          // 50%
  assert.equal(verdictFor(before, { attempts: 40, errors: 8 }), 'better'); // 20%, more errors
  assert.equal(verdictFor(before, { attempts: 10, errors: 5 }), 'same');
  assert.equal(verdictFor(before, { attempts: 10, errors: 8 }), 'again');
});

test('the review measures the pinned concepts against this session only', () => {
  const prev = { at: 1, items: [{ concept: 'articles', attempts: 10, errors: 5 }, { concept: 'modals', attempts: 4, errors: 2 }] };
  const review = reviewFocus(prev, stats(['articles', 20, 1]), { at: 2, analysisId: 'a2' });
  assert.equal(review.fromAt, 1);
  assert.equal(review.items[0].verdict, 'better');
  assert.deepEqual(review.items[1].after, { attempts: 0, errors: 0 }); // never mentioned
  assert.equal(review.items[1].verdict, 'unseen');
  assert.equal(reviewFocus(null, stats(['articles', 20, 1])), null); // first analysed session
});

test('the per-session concept slice is capped and errors can never exceed attempts', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ concept: `c${i}`, attempts: 12 - i, errors: 12 - i }));
  const map = seriesConcepts(rows);
  assert.equal(Object.keys(map).length, 8);
  assert.deepEqual(map.c0, [12, 12]);
  assert.deepEqual(seriesConcepts([{ concept: 'articles', attempts: 3, errors: 9 }]).articles, [3, 3]);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const g = require('./geminiAnalysis');

test('Gemini is the default main path, until switched off or over the cap', () => {
  assert.strictEqual(g.geminiAllowed({}, 0), true);
  assert.strictEqual(g.geminiAllowed(null, 9.99), true);
  assert.strictEqual(g.geminiAllowed({}, 10), false);
  assert.strictEqual(g.geminiAllowed({ gemini: false }, 0), false);
  assert.strictEqual(g.geminiAllowed({ geminiMonthlyUsd: 25 }, 12), true);
  assert.strictEqual(g.geminiAllowed({ geminiMonthlyUsd: 0 }, 0), false);
});

test('model comes from config, else the default', () => {
  assert.strictEqual(g.geminiModel({}), 'gemini-3.8-flash');
  assert.strictEqual(g.geminiModel({ geminiModel: 'gemini-x' }), 'gemini-x');
});

test('pace counts real words, not fillers', () => {
  assert.strictEqual(g.withoutFillers('Um, I went, uh, to the erm market. Hmm yes'), 'I went, to the market. yes');
  assert.strictEqual(g.withoutFillers('umbrella and ahead stay'), 'umbrella and ahead stay');
});

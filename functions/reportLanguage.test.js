'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { reportLanguageFor, hasForeignScript, foreignScriptNames } = require('./reportLanguage');

test('an explicit choice wins, ru included', () => {
  assert.strictEqual(reportLanguageFor({ preferredLanguage: 'ru', appLanguage: 'tr' }), 'ru');
  assert.strictEqual(reportLanguageFor({ preferredLanguage: 'az', appLanguage: 'tr' }), 'az');
  assert.strictEqual(reportLanguageFor({ preferredLanguage: 'tr' }), 'tr');
});

test('no choice: a Turkish device gets tr, anything else az', () => {
  assert.strictEqual(reportLanguageFor({ appLanguage: 'tr' }), 'tr');
  assert.strictEqual(reportLanguageFor({ appLanguage: 'en' }), 'az');
  assert.strictEqual(reportLanguageFor({ preferredLanguage: 'de' }), 'az');
  assert.strictEqual(reportLanguageFor(null), 'az');
});

test('Cyrillic is foreign in az/tr, native in ru', () => {
  const ru = { report_markdown: '## Привет!\nТвои сильные стороны' };
  assert.strictEqual(hasForeignScript(ru, 'az'), true);
  assert.strictEqual(hasForeignScript(ru, 'tr'), true);
  assert.strictEqual(hasForeignScript(ru, 'ru'), false);
});

test('CJK and Arabic are foreign in every language', () => {
  for (const lang of ['az', 'tr', 'ru']) {
    assert.strictEqual(hasForeignScript({ t: 'Это 否定 предложение' }, lang), true, lang);
    assert.strictEqual(hasForeignScript({ t: 'مرحبا' }, lang), true, lang);
  }
  assert.strictEqual(hasForeignScript({ t: 'Keçmiş zaman — went' }, 'az'), false);
});

test('the retry names only scripts that are foreign for the language', () => {
  assert.match(foreignScriptNames('az'), /Cyrillic/);
  assert.doesNotMatch(foreignScriptNames('ru'), /Cyrillic/);
});

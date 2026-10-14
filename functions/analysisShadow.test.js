const test = require('node:test');
const assert = require('node:assert');
const S = require('./analysisShadow');

const PROMPT = 'Intro {{x}}\n\nTRANSCRIPT:\n"""I go home"""\n\nRules here.\n\nCONCEPT LIST — ids:\npast_simple: …';

test('buildShadowPrompt swaps the transcript for the audio note and adds the extra rules before the concept list', () => {
  const p = S.buildShadowPrompt(PROMPT, 'Turkish');
  assert.ok(!p.includes('I go home'));
  assert.ok(p.includes('AUDIO:'));
  assert.ok(p.includes('NEVER mention pause lengths'));
  assert.ok(p.indexOf('EXTRA FIELDS') < p.indexOf('CONCEPT LIST'));
  assert.ok(p.includes('Turkish notes') || p.includes('tip = Turkish'));
  assert.ok(!p.includes('{{LANGUAGE}}'));
});

test('toGeminiSchema upper-cases types and drops additionalProperties at every depth', () => {
  const g = S.toGeminiSchema({
    type: 'object', additionalProperties: false, required: ['a'],
    properties: { a: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false, properties: { b: { type: 'string', enum: ['x'] } } } } },
  });
  assert.strictEqual(g.type, 'OBJECT');
  assert.strictEqual(g.additionalProperties, undefined);
  assert.strictEqual(g.properties.a.type, 'ARRAY');
  assert.strictEqual(g.properties.a.maxItems, undefined);
  assert.strictEqual(g.properties.a.items.additionalProperties, undefined);
  assert.deepStrictEqual(g.properties.a.items.properties.b, { type: 'STRING', enum: ['x'] });
  assert.deepStrictEqual(g.required, ['a']);
});

test('shadowSchema keeps the base fields and requires the new ones', () => {
  const g = S.shadowSchema({ type: 'object', required: ['recap'], properties: { recap: { type: 'string' } } });
  assert.deepStrictEqual(g.required, ['transcript', 'recap', 'delivery', 'pronunciation', 'best_moment']);
  assert.strictEqual(g.properties.recap.type, 'STRING');
  assert.strictEqual(g.properties.delivery.type, 'OBJECT');
});

test('shadowSchema drops only the deep concept enum Gemini refuses', () => {
  const concept = { type: 'string', enum: ['past_simple'] };
  const g = S.shadowSchema({
    type: 'object', required: [],
    properties: {
      error_themes: { type: 'array', items: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { concept } } } } } },
      concepts_used: { type: 'array', items: { type: 'object', properties: { concept } } },
    },
  });
  assert.strictEqual(g.properties.error_themes.items.properties.items.items.properties.concept.enum, undefined);
  assert.deepStrictEqual(g.properties.concepts_used.items.properties.concept.enum, ['past_simple']);
  assert.deepStrictEqual(concept.enum, ['past_simple']);
});

const T = 'um so yesterday I go to the bazaar eh it was very comfortable I tink if I had more time I would learn to cook';

test('normalizeExtras drops quotes that are not in the transcript and words never said', () => {
  const x = S.normalizeExtras({
    delivery: { fillers: [{ word: 'Um', count: 3 }, { word: '', count: 2 }, { word: 'eh', count: 0 }], hesitation: ['restarts "to the... to the"'], smoothest: 'cook hissəsi' },
    pronunciation: [
      { word: 'comfortable', heard: 'com-FOR-ta-ble', tip: 'vurğu əvvəldə', times: 1 },
      { word: 'beautiful', heard: 'byu-ti-ful', tip: 'x', times: 2 },
    ],
    best_moment: { quote: 'If I had more time, I would learn to cook.', why: 'tam şərt cümləsi' },
  }, T);
  assert.deepStrictEqual(x.delivery.fillers, [{ word: 'um', count: 3 }]);
  assert.strictEqual(x.pronunciation.length, 1);
  assert.strictEqual(x.pronunciation[0].word, 'comfortable');
  assert.strictEqual(x.bestMoment.why, 'tam şərt cümləsi');

  const y = S.normalizeExtras({ best_moment: { quote: 'I enjoy astrophysics lectures', why: 'x' } }, T);
  assert.strictEqual(y.bestMoment, null);
  assert.strictEqual(y.delivery, null);
  assert.deepStrictEqual(y.pronunciation, []);
});

test('normalizeExtras drops any line that talks in seconds or clock times', () => {
  const x = S.normalizeExtras({
    delivery: { fillers: [], hesitation: ['5 saniyə dayandın', '3 s pause', 'at 03:12 you stopped', 'cümləni yarıda saxladın'], smoothest: '07:40-da ən rahat idin' },
  }, T);
  assert.deepStrictEqual(x.delivery.hesitation, ['cümləni yarıda saxladın']);
  assert.strictEqual(x.delivery.smoothest, '');
});

test('shadowAllowed needs the switch and stays under the monthly cap', () => {
  assert.strictEqual(S.shadowAllowed(undefined, 0), false);
  assert.strictEqual(S.shadowAllowed({ shadowGemini: 'yes' }, 0), false);
  assert.strictEqual(S.shadowAllowed({ shadowGemini: true }, 2.9), true);
  assert.strictEqual(S.shadowAllowed({ shadowGemini: true }, 3), false);
  assert.strictEqual(S.shadowAllowed({ shadowGemini: true, shadowMonthlyUsd: 10 }, 5), true);
});

test('audioMimeType follows the recording extension', () => {
  assert.strictEqual(S.audioMimeType('callRecordings/u/a.webm'), 'audio/webm');
  assert.strictEqual(S.audioMimeType('callRecordings/u/a.mp4'), 'audio/mp4');
});

test('compareAnalyses counts fixes both found and the score gap', () => {
  const main = { scores: { fluency: 60, grammar: 70, vocabulary: 50 }, transcript: 'a b c',
    errorThemes: [{ items: [{ corrected: 'I went home.' }, { corrected: 'She wants' }] }] };
  const shadow = { scores: { fluency: 55, grammar: 70 }, transcript: 'a b c d',
    errorThemes: [{ items: [{ corrected: 'i went home' }] }, { items: [{ corrected: 'We bought' }] }] };
  const c = S.compareAnalyses(main, shadow);
  assert.strictEqual(c.mainFixes, 2);
  assert.strictEqual(c.shadowFixes, 2);
  assert.strictEqual(c.sameFixes, 1);
  assert.deepStrictEqual(c.scoreDelta, { fluency: -5, grammar: 0, vocabulary: null });
  assert.strictEqual(c.shadowWords, 4);
});

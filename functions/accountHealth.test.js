const test = require('node:test');
const assert = require('node:assert');
const H = require('./accountHealth');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-14T12:00:00+04:00');
const base = { lastSeenMs: NOW - DAY, callCount: 5, joinedAtMs: NOW - 60 * DAY, unanswered: 0, committed: false };
const c = (p) => H.classify({ ...base, ...p }, { nowMs: NOW });

test('a learner who practises and opens the app is active', () => {
  assert.deepStrictEqual(c({}), { cls: 'active', why: 'practising' });
  assert.deepStrictEqual(c({ committed: true }), { cls: 'active', why: 'said_in' });
  assert.strictEqual(H.planned(c({})), true);
});

test('away for a week sleeps, away for three weeks is a ghost — even with «in»', () => {
  assert.strictEqual(c({ lastSeenMs: NOW - 8 * DAY }).cls, 'sleeping');
  assert.strictEqual(c({ lastSeenMs: NOW - 8 * DAY, committed: true }).cls, 'sleeping');
  assert.strictEqual(c({ lastSeenMs: NOW - 22 * DAY }).cls, 'ghost');
  assert.strictEqual(c({ lastSeenMs: 0 }).cls, 'ghost');
});

test('two proposals left in a row sleep, unless they said «in» since', () => {
  assert.deepStrictEqual(c({ unanswered: 2 }), { cls: 'sleeping', why: 'silent' });
  assert.strictEqual(c({ unanswered: 2, committed: true }).cls, 'active');
});

test('no call yet: new while fresh or committed, otherwise not planned', () => {
  assert.deepStrictEqual(c({ callCount: 0, joinedAtMs: NOW - 3 * DAY }), { cls: 'new', why: 'joined' });
  assert.deepStrictEqual(c({ callCount: 0, committed: true }), { cls: 'new', why: 'said_in' });
  assert.deepStrictEqual(c({ callCount: 0 }), { cls: 'sleeping', why: 'no_first_call' });
  // The production case: never called, three proposals left → ghost.
  assert.deepStrictEqual(c({ callCount: 0, unanswered: 3, committed: true }), { cls: 'ghost', why: 'never_answered' });
  assert.strictEqual(H.planned(c({ callCount: 0, joinedAtMs: NOW - DAY })), true);
});

test('a flag keeps someone out until it is cleared', () => {
  assert.deepStrictEqual(c({ flag: 'suspicious' }), { cls: 'suspicious', why: 'flagged' });
  assert.strictEqual(H.planned(c({ flag: 'suspicious' })), false);
  assert.strictEqual(c({ flag: null }).cls, 'active');
});

test('summary counts every class', () => {
  const s = H.summarize([c({}), c({ callCount: 0, joinedAtMs: NOW }), c({ lastSeenMs: 0 })]);
  assert.deepStrictEqual(s, { active: 1, new: 1, sleeping: 0, ghost: 1, suspicious: 0 });
});

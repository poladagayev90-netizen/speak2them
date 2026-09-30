const test = require('node:test');
const assert = require('node:assert');
const { computeReliability, limitNotice, RELIABILITY_WINDOW_MS } = require('./reliability');

const NOW = Date.parse('2026-10-20T12:00:00Z');
const H = 60 * 60 * 1000;
const at = (hoursAgo, outcome, slotId = 's') => ({ outcome, atMs: NOW - hoursAgo * H, slotId });

test('nothing counted is ok', () => {
  assert.strictEqual(computeReliability([], { nowMs: NOW }).level, 'ok');
});

test('the platform failing the learner never counts', () => {
  const r = computeReliability([at(50, 'partner_no_show'), at(40, 'unmatched'), at(30, 'partner_no_show'), at(20, 'cancelled')], { nowMs: NOW });
  assert.strictEqual(r.level, 'ok');
  assert.strictEqual(r.points, 0);
});

test('one no-show is watch, not a limit', () => {
  const r = computeReliability([at(10, 'no_show')], { nowMs: NOW });
  assert.strictEqual(r.level, 'watch');
});

test('two no-shows in a row limit', () => {
  const r = computeReliability([at(30, 'no_show'), at(10, 'no_show')], { nowMs: NOW });
  assert.strictEqual(r.level, 'limited');
  assert.strictEqual(r.recoverLeft, 2);
});

test('an attended practice between two no-shows breaks the run', () => {
  const r = computeReliability([at(30, 'no_show'), at(20, 'attended'), at(10, 'no_show')], { nowMs: NOW });
  assert.strictEqual(r.level, 'watch');
  assert.strictEqual(r.points, 1.5);
});

test('late cancels add up to a limit at 3 points', () => {
  const six = [60, 50, 40, 30, 20, 10].map((h) => at(h, 'late_cancel'));
  assert.strictEqual(computeReliability(six.slice(0, 5), { nowMs: NOW }).level, 'watch');
  assert.strictEqual(computeReliability(six, { nowMs: NOW }).level, 'limited');
});

test('two attended in a row lift the limit and start from zero', () => {
  const ev = [at(40, 'no_show'), at(30, 'no_show'), at(20, 'attended')];
  const one = computeReliability(ev, { nowMs: NOW });
  assert.strictEqual(one.level, 'limited');
  assert.strictEqual(one.recoverLeft, 1);
  const two = computeReliability([...ev, at(10, 'attended')], { nowMs: NOW });
  assert.strictEqual(two.level, 'ok');
  assert.strictEqual(two.points, 0);
});

test('a direct call outside a booking does not count as attended', () => {
  const r = computeReliability([at(40, 'no_show'), at(30, 'no_show'), at(20, 'attended', null), at(10, 'attended', null)], { nowMs: NOW });
  assert.strictEqual(r.level, 'limited');
});

test('events older than four weeks and before an admin reset are forgotten', () => {
  const old = { outcome: 'no_show', atMs: NOW - RELIABILITY_WINDOW_MS - H, slotId: 's' };
  assert.strictEqual(computeReliability([old, at(10, 'no_show')], { nowMs: NOW }).level, 'watch');
  assert.strictEqual(computeReliability([at(30, 'no_show'), at(10, 'no_show')], { nowMs: NOW, resetAtMs: NOW - 5 * H }).level, 'ok');
});

test('the learner notice carries reason and way back, never points', () => {
  const r = computeReliability([at(30, 'no_show'), at(10, 'no_show')], { nowMs: NOW });
  const n = limitNotice(r, 3);
  assert.deepStrictEqual({ target: n.target, usualTarget: n.usualTarget, missed: n.missed, recoverLeft: n.recoverLeft }, { target: 1, usualTarget: 3, missed: 2, recoverLeft: 2 });
  assert.ok(!('points' in n));
  assert.strictEqual(limitNotice(computeReliability([], { nowMs: NOW }), 3), null);
});

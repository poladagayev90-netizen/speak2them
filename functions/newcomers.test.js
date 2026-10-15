const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./newcomers');
const wp = require('./weeklyPlanner');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-14T10:00:00+04:00'); // Wednesday
const dates = wp.weekDates('2026-10-12').filter((d) => d >= '2026-10-14');
const evenings = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, startMin: 19 * 60, endMin: 22 * 60 }));
const L = (uid, over = {}) => ({ uid, level: 'B1', availability: evenings, timeZone: 'Asia/Baku', need: 1, ...over });

test('finishing the wizard is «in» for three days; their own answer wins', () => {
  assert.equal(N.committedFor({ answer: null, calls: 0, joinedAtMs: NOW - DAY, nowMs: NOW }), true);
  assert.equal(N.committedFor({ answer: null, calls: 0, joinedAtMs: NOW - 4 * DAY, nowMs: NOW }), false);
  assert.equal(N.committedFor({ answer: { in: false }, calls: 0, joinedAtMs: NOW - DAY, nowMs: NOW }), false);
  assert.equal(N.committedFor({ answer: { in: true }, calls: 5, joinedAtMs: 0, nowMs: NOW }), true);
  // Someone who has practised is never «in» without saying so.
  assert.equal(N.committedFor({ answer: null, calls: 1, joinedAtMs: NOW - DAY, nowMs: NOW }), false);
  assert.equal(N.committedFor({ answer: null, calls: 0, joinedAtMs: 0, nowMs: NOW }), false);
});

test('a newcomer\'s partner: a reachable, recently active learner, or a fresh newcomer', () => {
  const vet = { calls: 4, hasPush: true, lastPracticeMs: NOW - 3 * DAY, lastSeenMs: NOW };
  assert.equal(N.newcomerOk(vet, NOW), true);
  assert.equal(N.newcomerOk({ ...vet, hasPush: false }, NOW), false);
  assert.equal(N.newcomerOk({ ...vet, lastPracticeMs: NOW - 20 * DAY }, NOW), false);
  assert.equal(N.newcomerOk({ ...vet, lastPracticeMs: 0, lastYesMs: NOW - DAY }, NOW), true);
  assert.equal(N.newcomerOk({ calls: 0, lastSeenMs: NOW - DAY }, NOW), true);
  assert.equal(N.newcomerOk({ calls: 0, lastSeenMs: NOW - 3 * DAY }, NOW), false);
});

test('pairAllowed: a newcomer is never paired with someone who will not show up', () => {
  const blocked = new Set();
  const nc = L('n', { newcomer: true, newcomerOk: true });
  assert.equal(wp.pairAllowed(nc, L('ghost', { newcomerOk: false }), blocked), false);
  assert.equal(wp.pairAllowed(L('ghost', { newcomerOk: false }), nc, blocked), false);
  assert.equal(wp.pairAllowed(nc, L('vet', { newcomerOk: true }), blocked), true);
  // Two older learners: the newcomer rule does not apply.
  assert.equal(wp.pairAllowed(L('x', { newcomerOk: false }), L('y', { newcomerOk: false }), blocked), true);
  // A newcomer gone for days is not given to another newcomer either.
  assert.equal(wp.pairAllowed(nc, L('n2', { newcomer: true, newcomerOk: false }), blocked), false);
  // Not judged = allowed (old callers).
  assert.equal(wp.pairAllowed(nc, L('z'), blocked), true);
});

test('buildWeekPlan leaves a newcomer unpaired rather than with a ghost', () => {
  const plan = wp.buildWeekPlan({
    learners: [L('n', { newcomer: true, newcomerOk: true }), L('ghost', { newcomerOk: false })],
    dates, earliestMs: NOW,
  });
  assert.equal(plan.pairs.length, 0);
});

test('hosts: config entries, Baku hours → ranges', () => {
  const hosts = N.parseHosts(['a', { uid: 'b', hours: { 3: [20, 21], 5: [19] } }, 'a', { nope: 1 }, 7]);
  assert.deepEqual(hosts.map((h) => h.uid), ['a', 'b']);
  assert.equal(hosts[0].hours, null);
  assert.deepEqual(N.hoursToRanges(hosts[1].hours), [
    { day: 3, startMin: 20 * 60, endMin: 22 * 60 },
    { day: 5, startMin: 19 * 60, endMin: 20 * 60 },
  ]);
  assert.equal(N.parseHosts('x').length, 0);
  assert.equal(N.parseHosts(['1', '2', '3', '4', '5', '6']).length, N.MAX_HOSTS);
});

test('hostPairs: earliest shared start within 72 h, one newcomer per host a day, oldest first', () => {
  const host = L('h', { busyDates: [] });
  const earliest = NOW + 3 * 60 * 60 * 1000; // Wed 13:00
  const pairs = N.hostPairs({
    newcomers: [L('n2', { joinedAtMs: NOW - 2 * 3600e3 }), L('n1', { joinedAtMs: NOW - 9 * 3600e3 })],
    hosts: [host], dates, earliestMs: earliest, latestMs: NOW + N.HOST_WINDOW_MS,
  });
  assert.deepEqual(pairs.map((p) => [p.a, p.slotId]), [['n1', '2026-10-14-19'], ['n2', '2026-10-15-19']]);
});

test('hostPairs: nothing beyond 72 h, nothing on the host\'s busy day, no minor with an adult host', () => {
  const late = [{ day: 0, startMin: 19 * 60, endMin: 22 * 60 }]; // Sunday only — 4+ days away
  const base = { dates, earliestMs: NOW, latestMs: NOW + N.HOST_WINDOW_MS };
  assert.equal(N.hostPairs({ ...base, newcomers: [L('n', { availability: late })], hosts: [L('h')] }).length, 0);
  const wedOnly = [{ day: 3, startMin: 19 * 60, endMin: 22 * 60 }];
  assert.equal(N.hostPairs({ ...base, newcomers: [L('n', { availability: wedOnly })], hosts: [L('h', { busyDates: ['2026-10-14'] })] }).length, 0);
  assert.equal(N.hostPairs({ ...base, newcomers: [L('n', { minor: true })], hosts: [L('h')] }).length, 0);
  assert.equal(N.hostPairs({ ...base, newcomers: [L('n')], hosts: [L('h')], blocked: new Set([wp.pairKey('n', 'h')]) }).length, 0);
});

test('hostPairs: never the host\'s own student', () => {
  const base = { dates, earliestMs: NOW, latestMs: NOW + N.HOST_WINDOW_MS };
  assert.equal(N.hostPairs({ ...base, newcomers: [L('n', { teacherId: 'h' })], hosts: [L('h')] }).length, 0);
  assert.equal(N.hostPairs({ ...base, newcomers: [L('n', { teacherId: 'other' })], hosts: [L('h')] }).length, 1);
});

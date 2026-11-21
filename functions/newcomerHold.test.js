const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./newcomerHold');
const wp = require('./weeklyPlanner');

const ADMIN = 'admin';
const base = { adminUid: ADMIN, hostUids: ['host'] };

test('a held learner meets nobody but the team', () => {
  assert.equal(H.peerGuard({ ...base, uidA: 'n', uidB: 'peer', holdA: true }).held, true);
  assert.equal(H.peerGuard({ ...base, uidA: 'peer', uidB: 'n', holdB: true }).held, true);
  assert.equal(H.peerGuard({ ...base, uidA: 'n', uidB: 'host', holdA: true }).held, false);
  assert.equal(H.peerGuard({ ...base, uidA: 'n', uidB: ADMIN, holdA: true }).held, false);
  // their own linked teacher
  assert.equal(H.peerGuard({ ...base, uidA: 'n', uidB: 't', a: { teacherId: 't' }, holdA: true }).held, false);
  // someone else's teacher is not the team
  assert.equal(H.peerGuard({ ...base, uidA: 'n', uidB: 't', a: { teacherId: 'x' }, holdA: true }).held, true);
  // no hold, no refusal
  assert.equal(H.peerGuard({ ...base, uidA: 'n', uidB: 'peer' }).held, false);
});

test('both held: still refused (two newcomers waiting for a teacher)', () => {
  assert.equal(H.peerGuard({ ...base, uidA: 'n1', uidB: 'n2', holdA: true, holdB: true }).held, true);
});

test('a test account meets only test accounts or the team', () => {
  const t = { testAccount: true };
  assert.equal(H.peerGuard({ ...base, uidA: 'x', uidB: 'real', a: t }).testClash, true);
  assert.equal(H.peerGuard({ ...base, uidA: 'real', uidB: 'x', b: t }).testClash, true);
  assert.equal(H.peerGuard({ ...base, uidA: 'x', uidB: 'y', a: t, b: t }).testClash, false);
  assert.equal(H.peerGuard({ ...base, uidA: 'x', uidB: ADMIN, a: t }).testClash, false);
  assert.equal(H.peerGuard({ ...base, uidA: 'x', uidB: 'host', a: t }).testClash, false);
  assert.equal(H.peerGuard({ ...base, uidA: 'x', uidB: 'y' }).testClash, false);
});

test('only a practice with the team lifts the hold', () => {
  assert.equal(H.liftsHold({ ...base, uid: 'n', peerUid: 'host' }), true);
  assert.equal(H.liftsHold({ ...base, uid: 'n', peerUid: ADMIN }), true);
  assert.equal(H.liftsHold({ ...base, uid: 'n', peerUid: 't', user: { teacherId: 't' } }), true);
  assert.equal(H.liftsHold({ ...base, uid: 'n', peerUid: 'peer' }), false);
});

test('planner: held and test learners are never paired with peers', () => {
  const L = (uid, extra = {}) => ({ uid, ...extra });
  const none = new Set();
  assert.equal(wp.pairAllowed(L('n', { hold: true }), L('p'), none), false);
  assert.equal(wp.pairAllowed(L('p'), L('n', { hold: true }), none), false);
  assert.equal(wp.pairAllowed(L('n', { hold: true }), L('h', { host: true }), none), true);
  assert.equal(wp.pairAllowed(L('h', { host: true }), L('n', { hold: true }), none), true);
  assert.equal(wp.pairAllowed(L('t', { test: true }), L('p'), none), false);
  assert.equal(wp.pairAllowed(L('t', { test: true }), L('t2', { test: true }), none), true);
  assert.equal(wp.pairAllowed(L('t', { test: true }), L('h', { host: true }), none), true);
});

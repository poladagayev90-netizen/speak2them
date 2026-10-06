const test = require('node:test');
const assert = require('node:assert');
const P = require('./packages');

const DAY = 24 * 60 * 60 * 1000;
// Wednesday 2026-10-21 12:00 Baku.
const NOW = Date.parse('2026-10-21T12:00:00+04:00');
const MONDAY = Date.parse('2026-10-19T00:00:00+04:00');
const cfg = P.billingConfig({});
const b = (startMs, status, extra = {}) => ({ participants: ['me', 'you'], startMs, status, ...extra });

test('week starts Monday 00:00 Baku', () => {
  assert.strictEqual(P.weekStartMs(NOW), MONDAY);
  assert.strictEqual(P.weekStartMs(MONDAY), MONDAY);
  assert.strictEqual(P.weekStartMs(MONDAY - 1), MONDAY - 7 * DAY);
});

test('each booking outcome counts the right way', () => {
  const v = (x) => P.bookingVerdict(x, 'me');
  assert.strictEqual(v(b(NOW, 'confirmed')), 'reserved');
  assert.strictEqual(v(b(NOW, 'done', { outcome: { me: 'attended' } })), 'used');
  assert.strictEqual(v(b(NOW, 'done', { outcome: { me: 'no_show' } })), 'used');
  assert.strictEqual(v(b(NOW, 'done', { outcome: { me: 'partner_no_show' } })), 'returned');
  assert.strictEqual(v(b(NOW, 'done', { outcome: { me: 'arrived' } })), 'returned');
  assert.strictEqual(v(b(NOW, 'cancelled', { cancelledBy: 'me', late: true })), 'used');
  assert.strictEqual(v(b(NOW, 'cancelled', { cancelledBy: 'me', late: false })), 'returned');
  assert.strictEqual(v(b(NOW, 'cancelled', { cancelledBy: 'you', late: true })), 'returned');
  assert.strictEqual(v(b(NOW, 'cancelled', { replacedBy: 'teacher_match' })), 'returned');
  assert.strictEqual(v(b(NOW, 'moved')), null);
  assert.strictEqual(v({ participants: ['x', 'y'], status: 'confirmed', startMs: NOW }), null);
});

test('unlimited: admin, Pro, course, teacher free access, paid plan', () => {
  assert.ok(P.isUnlimited({}, 'adm', 'adm', NOW));
  assert.ok(P.isUnlimited({ isPremium: true }, 'me', 'adm', NOW));
  assert.ok(P.isUnlimited({ cohortStatus: 'active' }, 'me', 'adm', NOW));
  assert.ok(P.isUnlimited({ freeAccessUntil: NOW + DAY }, 'me', 'adm', NOW));
  assert.ok(P.isUnlimited({ subscriptionPlan: 'unlimited' }, 'me', 'adm', NOW));
  assert.ok(!P.isUnlimited({ subscriptionPlan: 'trial', freeAccessUntil: NOW - DAY }, 'me', 'adm', NOW));
});

test('trial: three free practices in total, refunds do not count', () => {
  const user = { trialStartedAt: NOW - 30 * DAY };
  const bookings = [
    b(NOW - 20 * DAY, 'done', { outcome: { me: 'attended' } }),
    b(MONDAY + DAY, 'done', { outcome: { me: 'partner_no_show' } }),
    b(NOW + DAY, 'confirmed'),
  ];
  const s = P.accessState({ uid: 'me', user, config: cfg, bookings, nowMs: NOW });
  assert.strictEqual(s.kind, 'trial');
  assert.deepStrictEqual([s.used, s.reserved, s.returned, s.remaining], [1, 1, 1, 1]);
  assert.ok(P.canBookAt(s, NOW + 2 * DAY, bookings, 'me'));
  // No weekly reset and no end date: the third one is the last.
  const full = [...bookings, b(NOW + 2 * DAY, 'confirmed')];
  const s2 = P.accessState({ uid: 'me', user, config: cfg, bookings: full, nowMs: NOW });
  assert.strictEqual(s2.kind, 'trial');
  assert.ok(!P.canBookAt(s2, MONDAY + 30 * DAY, full, 'me'));
  // Once those two have happened, it is over.
  const done = full.map((x) => (x.status === 'confirmed' ? { ...x, status: 'done', outcome: { me: 'attended' } } : x));
  const s3 = P.accessState({ uid: 'me', user, config: cfg, bookings: done, nowMs: NOW + 5 * DAY });
  assert.strictEqual(s3.kind, 'none');
  assert.strictEqual(P.allowanceForWeek(s3, MONDAY + 7 * DAY), 0);
});

test('free practices count from the switch-on when that is later', () => {
  const old = { trialStartedAt: NOW - 200 * DAY };
  const before = [b(NOW - 100 * DAY, 'done', { outcome: { me: 'attended' } }),
    b(NOW - 90 * DAY, 'done', { outcome: { me: 'attended' } }), b(NOW - 80 * DAY, 'done', { outcome: { me: 'attended' } })];
  assert.strictEqual(P.accessState({ uid: 'me', user: old, config: cfg, bookings: before, nowMs: NOW }).kind, 'none');
  const on = P.billingConfig({ enforce: true, enabledAt: NOW - 2 * DAY });
  const s = P.accessState({ uid: 'me', user: old, config: on, bookings: before, nowMs: NOW });
  assert.strictEqual(s.kind, 'trial');
  assert.strictEqual(s.remaining, 3);
  assert.strictEqual(P.billingConfig({ trialPractices: 5 }).trialPractices, 5);
});

test('package: size + carried − used − reserved', () => {
  const accessDoc = { package: { size: 8, carriedIn: 2, startsAt: NOW - 10 * DAY, endsAt: NOW + 20 * DAY } };
  const bookings = [
    b(NOW - 9 * DAY, 'done', { outcome: { me: 'attended' } }),
    b(NOW - 8 * DAY, 'done', { outcome: { me: 'no_show' } }),
    b(NOW - 7 * DAY, 'done', { outcome: { me: 'partner_no_show' } }),
    b(NOW - 6 * DAY, 'cancelled', { cancelledBy: 'you', late: true }),
    b(NOW + DAY, 'confirmed'),
    b(NOW - 30 * DAY, 'done', { outcome: { me: 'attended' } }), // before the period
  ];
  const s = P.accessState({ uid: 'me', user: { trialStartedAt: NOW - 100 * DAY }, accessDoc, config: cfg, bookings, nowMs: NOW });
  assert.strictEqual(s.kind, 'package');
  assert.deepStrictEqual([s.total, s.used, s.reserved, s.returned, s.remaining], [10, 2, 1, 2, 7]);
  assert.ok(P.canBookAt(s, NOW + 2 * DAY, bookings, 'me'));
  assert.ok(!P.canBookAt(s, NOW + 21 * DAY, bookings, 'me'));
});

test('an expired package is none; a Pro learner is never counted', () => {
  const accessDoc = { package: { size: 8, startsAt: NOW - 40 * DAY, endsAt: NOW - 10 * DAY } };
  const user = { trialStartedAt: NOW - 100 * DAY };
  assert.strictEqual(P.accessState({ uid: 'me', user, accessDoc, config: cfg, bookings: [], nowMs: NOW }).kind, 'none');
  const pro = P.accessState({ uid: 'me', user: { ...user, isPremium: true }, accessDoc, config: cfg, bookings: [], nowMs: NOW });
  assert.strictEqual(pro.kind, 'unlimited');
  assert.strictEqual(P.allowanceForWeek(pro, MONDAY, [], 'me'), Infinity);
});

test('renewing: everything left moves over early, only refunds after the end', () => {
  const running = { kind: 'package', remaining: 5, returned: 3, periodEndMs: NOW + DAY };
  assert.strictEqual(P.grantPackage({ size: 12, nowMs: NOW, config: cfg, previous: running }).carriedIn, 5);
  const ended = { kind: 'package', remaining: 5, returned: 3, periodEndMs: NOW - DAY };
  assert.strictEqual(P.grantPackage({ size: 12, nowMs: NOW, config: cfg, previous: ended }).carriedIn, 3);
  const many = { kind: 'package', remaining: 9, returned: 7, periodEndMs: NOW - DAY };
  assert.strictEqual(P.grantPackage({ size: 8, nowMs: NOW, config: cfg, previous: many }).carriedIn, 4);
  const long = { kind: 'package', remaining: 5, returned: 3, periodEndMs: NOW - 60 * DAY };
  assert.strictEqual(P.grantPackage({ size: 8, nowMs: NOW, config: cfg, previous: long }).carriedIn, 0);
  const g = P.grantPackage({ size: 16, nowMs: NOW, config: cfg });
  assert.strictEqual(g.endsMs - g.startsMs, 30 * DAY);
  assert.throws(() => P.grantPackage({ size: 7, nowMs: NOW, config: cfg }), /unknown-package/);
});

test('config defaults: switched off, 6/8/10/12 AZN', () => {
  assert.strictEqual(cfg.enforce, false);
  assert.deepStrictEqual(cfg.packages.map((p) => [p.size, p.price]), [[8, 6], [12, 8], [16, 10], [20, 12]]);
  assert.strictEqual(P.billingConfig({ carryMax: 0 }).carryMax, 0);
});

test('summary drops Infinity and unknown keys', () => {
  assert.deepStrictEqual(P.accessSummary({ kind: 'unlimited', remaining: Infinity, junk: 1 }), { kind: 'unlimited', remaining: null });
});

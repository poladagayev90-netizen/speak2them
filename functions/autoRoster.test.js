const test = require('node:test');
const assert = require('node:assert');
const A = require('./autoRoster');

const DAY = 24 * 60 * 60 * 1000;
const WEEK = Date.parse('2026-10-12T00:00:00+04:00'); // Monday
const NOW = WEEK + 2 * DAY;
const base = { hasTimes: true, charter: true, lastSeenMs: NOW - DAY, joinedAtMs: WEEK - 30 * DAY, unanswered: 0 };
const v = (p) => A.eligible({ ...base, ...p }, { weekStartMs: WEEK, nowMs: NOW });

test('silence means not planned; saying «in» or a package means planned', () => {
  assert.deepStrictEqual(v({}), { in: false, why: 'not_confirmed' });
  assert.deepStrictEqual(v({ answer: { in: true, days: [] } }), { in: true, why: 'said_in' });
  assert.deepStrictEqual(v({ paid: true }), { in: true, why: 'package' });
  assert.deepStrictEqual(v({ paid: true, answer: { in: false } }), { in: false, why: 'skipped' });
});

test('a week without opening the app = asleep, even with a package', () => {
  assert.strictEqual(v({ lastSeenMs: NOW - 8 * DAY, paid: true }).why, 'asleep');
  assert.strictEqual(v({ lastSeenMs: NOW - 8 * DAY, answer: { in: true } }).why, 'asleep');
  assert.strictEqual(v({ lastSeenMs: NOW - 6 * DAY, answer: { in: true } }).in, true);
});

test('newcomers are in for the week they join (or join at the weekend before)', () => {
  assert.strictEqual(v({ joinedAtMs: NOW - 3600e3 }).why, 'new');
  assert.strictEqual(v({ joinedAtMs: WEEK - DAY }).why, 'new');
  assert.strictEqual(v({ joinedAtMs: WEEK - 5 * DAY }).why, 'not_confirmed');
});

test('two unanswered proposals in a row snooze; any answer wakes them', () => {
  assert.strictEqual(v({ unanswered: 2, paid: true }).why, 'snoozed');
  assert.strictEqual(v({ unanswered: 2, answer: { in: true } }).in, true);
  const offers = [
    { startMs: 1, status: 'expired', response: 'pending', source: 'weekly_plan' },
    { startMs: 2, status: 'confirmed', response: 'accepted', source: 'weekly_plan' },
    { startMs: 3, status: 'expired', response: 'pending', source: 'weekly_plan' },
    { startMs: 4, status: 'expired', response: 'pending', source: 'weekly_plan' },
  ];
  assert.strictEqual(A.unansweredStreak(offers), 2);
  assert.strictEqual(A.unansweredStreak(offers, 3.5), 1); // said «in» after the third
  assert.strictEqual(A.unansweredStreak([...offers, { startMs: 5, status: 'declined', response: 'declined' }]), 0);
  assert.strictEqual(A.unansweredStreak([{ startMs: 1, status: 'pending', response: 'pending' }]), 0); // still open
});

test('a learner who said yes lately is in without being asked', () => {
  assert.deepStrictEqual(v({ proven: true }), { in: true, why: 'regular' });
  assert.strictEqual(v({ proven: true, answer: { in: false } }).why, 'skipped');
  assert.strictEqual(v({ proven: true, unanswered: 2 }).why, 'snoozed');
  assert.strictEqual(A.provenRecently([{ response: 'accepted', startMs: NOW - 5 * DAY }], NOW), true);
  assert.strictEqual(A.provenRecently([{ response: 'accepted', startMs: NOW - 30 * DAY }], NOW), false);
  assert.strictEqual(A.provenRecently([{ response: 'declined', startMs: NOW }], NOW), false);
});

test('only proposals with a fair window count as silence', () => {
  const short = { status: 'expired', response: 'pending', windowMs: 5 * 3600e3 };
  const fair = { status: 'expired', response: 'pending', windowMs: 20 * 3600e3 };
  assert.strictEqual(A.unansweredStreak([{ ...short, startMs: 1 }, { ...short, startMs: 2 }]), 0);
  assert.strictEqual(A.unansweredStreak([{ ...fair, startMs: 1 }, { ...short, startMs: 2 }, { ...fair, startMs: 3 }]), 2);
  // Old offers without sentAtMs: plan offers count, refill ones do not.
  assert.strictEqual(A.unansweredStreak([{ status: 'expired', response: 'pending', source: 'refill', startMs: 1 }]), 0);
});

test('admin override and set-up', () => {
  assert.strictEqual(v({ excluded: true, paid: true }).why, 'excluded');
  assert.strictEqual(v({ included: true, lastSeenMs: 0 }).why, 'included');
  assert.strictEqual(v({ hasTimes: false, included: true }).why, 'not_set_up');
  assert.strictEqual(v({ charter: false }).why, 'not_set_up');
  assert.strictEqual(v({ paused: true, paid: true }).why, 'paused');
  assert.strictEqual(v({ paid: true, practicesLeft: false }).why, 'no_practices_left');
});

test('week answer: picked days narrow the times and set the number', () => {
  const ob = { weeks: { '2026-10-12': { days: [1, 3, 3, 9], at: { _seconds: 5 } }, '2026-10-19': { skip: true } } };
  assert.deepStrictEqual(A.weekAnswer(ob, '2026-10-12'), { in: true, days: [1, 3], atMs: 5000 });
  assert.strictEqual(A.weekAnswer(ob, '2026-10-19').in, false);
  assert.strictEqual(A.weekAnswer(ob, '2026-10-26'), null);
  const avail = [{ day: 1, startMin: 1200, endMin: 1320 }, { day: 2, startMin: 1200, endMin: 1320 }, { day: 3, startMin: 1200, endMin: 1320 }];
  assert.deepStrictEqual(A.weekAvailability(avail, { in: true, days: [1, 3] }).map((r) => r.day), [1, 3]);
  assert.strictEqual(A.weekAvailability(avail, { in: true, days: [] }).length, 3);
  assert.strictEqual(A.weekTarget(2, { in: true, days: [1, 3, 5] }), 3);
  assert.strictEqual(A.weekTarget(2, { in: true, days: [] }), 2);
  assert.deepStrictEqual(A.summarize([{ in: true, why: 'package' }, { in: false, why: 'asleep' }, { in: false, why: 'asleep' }]),
    { in: 1, out: 2, why: { package: 1, asleep: 2 } });
});

test('picked hours replace that week times, odd values dropped', () => {
  const ob = { weeks: { '2026-10-12': { days: [3], hours: { 3: [20, 21], 6: [11], 9: [1], 2: ['x', 25] }, at: { _seconds: 5 } } } };
  const a = A.weekAnswer(ob, '2026-10-12');
  assert.deepStrictEqual(a.days, [3, 6]);
  assert.deepStrictEqual(A.weekAvailability([{ day: 1, startMin: 1200, endMin: 1320 }], a), [
    { day: 3, startMin: 1200, endMin: 1320 },
    { day: 6, startMin: 660, endMin: 720 },
  ]);
  assert.strictEqual(A.weekTarget(1, a), 2);
  assert.strictEqual(A.weekTarget(1, { in: true, days: [0, 1, 2, 3, 4, 5] }), 4); // never more than 4
  assert.deepStrictEqual(A.weekAvailability([], { in: true, days: [2], hours: { 2: [19, 21] } }), [
    { day: 2, startMin: 1140, endMin: 1200 }, { day: 2, startMin: 1260, endMin: 1320 },
  ]);
});

test('week profile: Never hours leave even this week\'s picked hours; Maybe follows the answer', () => {
  const never = [{ day: 2, startMin: 20 * 60, endMin: 21 * 60 }];
  assert.deepStrictEqual(A.weekAvailability([], { in: true, days: [2], hours: { 2: [19, 20, 21] } }, never), [
    { day: 2, startMin: 19 * 60, endMin: 20 * 60 }, { day: 2, startMin: 21 * 60, endMin: 22 * 60 },
  ]);
  assert.deepStrictEqual(A.weekAvailability([{ day: 2, startMin: 20 * 60, endMin: 21 * 60 }], null, never), []);
  assert.deepStrictEqual(A.weekAvailability([{ day: 1, startMin: 1200, endMin: 1320 }], null), [{ day: 1, startMin: 1200, endMin: 1320 }]);
  const maybe = [{ day: 1, startMin: 600, endMin: 720 }, { day: 6, startMin: 600, endMin: 720 }];
  assert.deepStrictEqual(A.weekMaybe(maybe, null), maybe);
  assert.deepStrictEqual(A.weekMaybe(maybe, { in: true, days: [6] }), [maybe[1]]);
  assert.deepStrictEqual(A.weekMaybe(maybe, { in: true, days: [6], hours: { 6: [12] } }), []);
  assert.deepStrictEqual(A.weekMaybe(undefined, null), []);
});

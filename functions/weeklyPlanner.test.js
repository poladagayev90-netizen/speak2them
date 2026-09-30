const test = require('node:test');
const assert = require('node:assert/strict');
const av = require('./availability');
const wp = require('./weeklyPlanner');

const MON = '2026-10-05';
const dates = wp.weekDates(MON);
// Free every day 18:00–23:00 in the learner's zone (Baku by default).
const evenings = (tz) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, startMin: 18 * 60, endMin: 23 * 60 }));
const L = (uid, over = {}) => ({ uid, name: uid, level: 'B1', availability: evenings(), timeZone: 'Asia/Baku', need: 1, ...over });
const byPerson = (plan) => {
  const m = new Map();
  for (const p of plan.pairs) for (const u of [p.a, p.b]) { if (!m.has(u)) m.set(u, []); m.get(u).push(p); }
  return m;
};

test('availability: Baku conversion, wrap past midnight, 30-minute window', () => {
  assert.deepEqual(av.toBakuIntervals([{ day: 1, startMin: 17 * 60, endMin: 18 * 60 }], 'Europe/Istanbul', new Date('2026-10-05T12:00:00Z')),
    [[1 * 1440 + 18 * 60, 1 * 1440 + 19 * 60]]);
  const sat = av.toWeekIntervals([{ day: 6, startMin: 23 * 60, endMin: 24 * 60 }], 60);
  assert.deepEqual(sat, [[0, 60]]); // Saturday 23:00 +1h = Sunday 00:00
  assert.ok(av.covers([[100, 130]], 100, 130));
  assert.ok(!av.covers([[100, 129]], 100, 130));
});

test('a block needs 30 free minutes from its start, not an hour', () => {
  const only = [{ day: 1, startMin: 20 * 60, endMin: 20 * 60 + 30 }]; // Mon 20:00–20:30
  assert.deepEqual(wp.freeSlots({ availability: only, timeZone: 'Asia/Baku' }, dates, 0), [`${MON}-20`]);
  const short = [{ day: 1, startMin: 20 * 60, endMin: 20 * 60 + 20 }];
  assert.deepEqual(wp.freeSlots({ availability: short, timeZone: 'Asia/Baku' }, dates, 0), []);
});

test('DST: Berlin moves against Baku in late October, Istanbul does not', () => {
  const berlin = { availability: [{ day: 1, startMin: 16 * 60, endMin: 17 * 60 }], timeZone: 'Europe/Berlin' };
  const ist = { availability: [{ day: 1, startMin: 17 * 60, endMin: 18 * 60 }], timeZone: 'Europe/Istanbul' };
  assert.deepEqual(wp.freeSlots(berlin, wp.weekDates('2026-10-05'), 0), ['2026-10-05-18']); // CEST: 16:00 Berlin = 18:00 Baku
  assert.deepEqual(wp.freeSlots(berlin, wp.weekDates('2026-10-26'), 0), []);                // CET: 16:00 Berlin = 19:00 Baku
  assert.deepEqual(wp.freeSlots(ist, wp.weekDates('2026-10-26'), 0), ['2026-10-26-18']);
});

test('targets are respected, one practice a day, a pair at most once a week', () => {
  const plan = wp.buildWeekPlan({ learners: ['a', 'b', 'c', 'd'].map((u) => L(u, { need: 3 })), dates, seed: 't' });
  const per = byPerson(plan);
  for (const [, list] of per) {
    assert.ok(list.length <= 3);
    const days = list.map((p) => p.slotId.slice(0, 10));
    assert.equal(new Set(days).size, days.length, 'one a day');
  }
  const keys = plan.pairs.map((p) => [p.a, p.b].sort().join());
  assert.equal(new Set(keys).size, keys.length, 'no repeat pair');
  assert.equal(plan.pairs.length, 6, 'four people × 3 = 6 pairs (every pair once)');
  assert.equal(plan.unmet.length, 0);
});

test('blocked, avoided and minor/adult pairs are never planned', () => {
  const plan = wp.buildWeekPlan({
    learners: [L('a'), L('b'), L('kid', { minor: true }), L('c')],
    blocked: new Set([wp.pairKey('a', 'b')]),
    dates, seed: 't',
  });
  for (const p of plan.pairs) {
    assert.notEqual([p.a, p.b].sort().join(), 'a,b');
    assert.ok(!(p.a === 'kid' || p.b === 'kid'), 'the minor has no minor partner, so no pair');
  }
  assert.ok(plan.unmet.some((u) => u.uid === 'kid' && u.reason === 'no_overlap'));
});

test('"close level" rules out a gap of more than one level', () => {
  const plan = wp.buildWeekPlan({ learners: [L('a', { level: 'A1', partnerLevel: 'close' }), L('b', { level: 'B2' })], dates, seed: 't' });
  assert.equal(plan.pairs.length, 0);
  const ok = wp.buildWeekPlan({ learners: [L('a', { level: 'A2', partnerLevel: 'close' }), L('b', { level: 'B1' })], dates, seed: 't' });
  assert.equal(ok.pairs.length, 1);
});

test('same level is preferred when there is a choice', () => {
  const plan = wp.buildWeekPlan({ learners: [L('x', { level: 'B1' }), L('near', { level: 'B1' }), L('far', { level: 'C1' }), L('far2', { level: 'C1' })], dates, seed: 't' });
  const x = plan.pairs.find((p) => p.a === 'x' || p.b === 'x');
  assert.ok([x.a, x.b].includes('near'));
});

test('an odd person out is reported, with the reason', () => {
  const plan = wp.buildWeekPlan({ learners: [L('a'), L('b'), L('c'), L('nobody', { availability: [] })], dates, seed: 't' });
  assert.equal(plan.pairs.length, 1);
  const reasons = Object.fromEntries(plan.unmet.map((u) => [u.uid, u.reason]));
  assert.equal(reasons.nobody, 'no_times');
  assert.equal(Object.keys(reasons).length, 2);
});

test('fairness: everyone gets one before anyone gets a second', () => {
  // hub wants 3, three others want 1 each and can only meet hub on Monday… no:
  // they are free all week, but there are only 3 partners → hub gets 3, others 1.
  const plan = wp.buildWeekPlan({ learners: [L('hub', { need: 3 }), L('p1'), L('p2'), L('p3'), L('q1', { need: 2 })], dates, seed: 't' });
  const per = byPerson(plan);
  for (const u of ['p1', 'p2', 'p3']) assert.equal((per.get(u) || []).length, 1, `${u} got one`);
  assert.equal(plan.unmet.filter((u) => u.got === 0).length, 0, 'nobody is left with zero');
});

test('existing bookings count: busy days and existing partners are respected', () => {
  const plan = wp.buildWeekPlan({
    learners: [L('a', { busyDates: [dates[0], dates[1]], pairedWith: ['b'] }), L('b'), L('c')],
    dates, seed: 't',
  });
  for (const p of plan.pairs) {
    if (p.a === 'a' || p.b === 'a') {
      assert.ok(![dates[0], dates[1]].includes(p.slotId.slice(0, 10)));
      assert.ok(!(p.a === 'b' || p.b === 'b'));
    }
  }
});

test('nothing before earliestMs, and alternatives never break a day', () => {
  const earliest = wp.blockStartMs(dates[2], 0);
  const plan = wp.buildWeekPlan({ learners: [L('a', { need: 2 }), L('b', { need: 2 })], dates, earliestMs: earliest, seed: 't' });
  for (const p of plan.pairs) {
    assert.ok(p.startMs >= earliest);
    for (const alt of p.alternatives) assert.ok(wp.blockStartMs(alt.slice(0, 10), Number(alt.slice(11))) >= earliest);
  }
});

test('same inputs + same seed = same plan; a met-this-week pair goes last', () => {
  const ls = ['a', 'b', 'c', 'd', 'e', 'f'].map((u) => L(u, { need: 2 }));
  const one = wp.buildWeekPlan({ learners: ls, dates, seed: '2026-10-05' });
  const two = wp.buildWeekPlan({ learners: ls, dates, seed: '2026-10-05' });
  assert.deepEqual(one.pairs, two.pairs);
  const recent = wp.buildWeekPlan({ learners: [L('a'), L('b'), L('c'), L('d')], recent: new Set([wp.pairKey('a', 'b'), wp.pairKey('c', 'd')]), dates, seed: 'x' });
  for (const p of recent.pairs) assert.notEqual([p.a, p.b].sort().join(), 'a,b');
});

test('30 learners plan quickly', () => {
  const ls = Array.from({ length: 30 }, (_, i) => L(`u${i}`, { need: 1 + (i % 4), level: ['A2', 'B1', 'B2'][i % 3] }));
  const t0 = Date.now();
  const plan = wp.buildWeekPlan({ learners: ls, dates, seed: 's' });
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
  assert.ok(plan.stats.planned >= plan.stats.demand * 0.9, `planned ${plan.stats.planned} of ${plan.stats.demand}`);
});

test('a learner under a reliability limit is never paired with a newcomer', () => {
  const plan = wp.buildWeekPlan({
    learners: [L('lim', { limited: true }), L('new', { newcomer: true }), L('old')],
    dates, earliestMs: 0,
  });
  const keys = plan.pairs.map((p) => wp.pairKey(p.a, p.b));
  assert.ok(!keys.includes(wp.pairKey('lim', 'new')));
  assert.ok(!wp.pairAllowed({ uid: 'x', newcomer: true }, { uid: 'y', limited: true }, new Set()));
  assert.ok(wp.pairAllowed({ uid: 'x', limited: true }, { uid: 'y' }, new Set()));
});

test('a starred partner is preferred, a mutual star even more', () => {
  // ann can meet bea or cal once; both are the same level and free at the same times.
  const learners = [L('ann'), L('bea'), L('cal')];
  const plain = wp.buildWeekPlan({ learners, dates, earliestMs: 0, seed: 's1' });
  assert.equal(plain.pairs.length, 1);
  for (const seed of ['s1', 's2', 's3', 's4']) {
    const fav = new Map([[wp.pairKey('ann', 'cal'), 1]]);
    const plan = wp.buildWeekPlan({ learners, favorites: fav, dates, earliestMs: 0, seed });
    assert.equal(wp.pairKey(plan.pairs[0].a, plan.pairs[0].b), wp.pairKey('ann', 'cal'), `seed ${seed}`);
    assert.ok(plan.pairs[0].reasons.includes('asked to practise again'));
  }
  // A recent meeting does not push a starred pair back.
  const recent = new Set([wp.pairKey('ann', 'cal')]);
  const plan = wp.buildWeekPlan({ learners, recent, favorites: new Map([[wp.pairKey('ann', 'cal'), 2]]), dates, earliestMs: 0, seed: 's5' });
  assert.equal(wp.pairKey(plan.pairs[0].a, plan.pairs[0].b), wp.pairKey('ann', 'cal'));
  assert.ok(plan.pairs[0].reasons.includes('both want to practise again'));
});

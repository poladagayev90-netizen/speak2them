const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseHostConfigs, hostPresentation, hostSlotAvailable, planInstantMatch,
} = require('./instantMatch');

const ADMIN = 'admin_polad';
// Sun 2026-11-22 10:00 UTC = 14:00 Baku
const NOW = Date.parse('2026-11-22T10:00:00Z');

test('parseHostConfigs handles strings and rich host objects with bounds', () => {
  const hosts = parseHostConfigs([
    { uid: ADMIN, hours: { 1: [19, 20], 3: [10] }, maxPerDay: 3, minLeadHours: 2 },
    'partner_1',
    { uid: ADMIN, hours: { 2: [10] } }, // duplicate dropped
  ], ADMIN);
  assert.equal(hosts.length, 2);
  assert.equal(hosts[0].isFounder, true);
  assert.equal(hosts[0].maxPerDay, 3);
  assert.equal(hosts[1].uid, 'partner_1');
  assert.equal(hosts[1].isFounder, false);
  assert.equal(hosts[1].maxPerDay, 2);
});

test('hostPresentation labels Polad honestly as SpeakLab team and others as Verified Partner', () => {
  const f = hostPresentation({ uid: ADMIN, name: 'Steel', adminUid: ADMIN });
  assert.equal(f.hostLabel, 'Polad · SpeakLab team');
  assert.equal(f.hostBadge, 'SpeakLab team');
  const p = hostPresentation({ uid: 'u2', name: 'Sabina Mammadova', adminUid: ADMIN });
  assert.equal(p.hostLabel, 'Sabina · Verified Partner');
  assert.equal(p.hostBadge, 'Verified Partner');
});

test('Tier 1 books earliest Free overlap within 72h and respects host maxPerDay + 2h gap', () => {
  const hosts = [{ uid: ADMIN, name: 'Polad', hours: { 1: [19, 20, 21], 2: [19] }, maxPerDay: 2, minLeadHours: 2, isFounder: true }];
  const learner = {
    uid: 'new1', minor: false, timeZone: 'Asia/Baku',
    availability: [{ day: 1, startMin: 19 * 60, endMin: 22 * 60 }, { day: 2, startMin: 19 * 60, endMin: 20 * 60 }],
  };
  // Mon 19:00 is already taken by host; 20:00 overlaps 19:00 (within 2h); 21:00 is open!
  const hostBookings = new Map([[ADMIN, [{ date: '2026-11-23', startMs: Date.parse('2026-11-23T19:00:00+04:00') }]]]);
  const res = planInstantMatch({ learner, hosts, hostBookings, nowMs: NOW, adminUid: ADMIN });
  assert.equal(res.tier, 1);
  assert.equal(res.candidates[0].slotId, '2026-11-23-21');
  assert.equal(res.candidates[0].hostLabel, 'Polad · SpeakLab team');
  assert.ok(res.alternatives.length >= 1);
  assert.equal(hostSlotAvailable(hosts[0], '2026-11-23-20', hostBookings.get(ADMIN)), false);
});

test('Tier 2 falls back to Maybe hours when Free has no overlap', () => {
  const hosts = [{ uid: ADMIN, name: 'Polad', hours: { 3: [18] }, maxPerDay: 2, minLeadHours: 2, isFounder: true }];
  const learner = {
    uid: 'new2', minor: false, timeZone: 'Asia/Baku',
    availability: [{ day: 1, startMin: 9 * 60, endMin: 10 * 60 }],
    maybeAvailability: [{ day: 3, startMin: 18 * 60, endMin: 19 * 60 }],
  };
  const res = planInstantMatch({ learner, hosts, nowMs: NOW, adminUid: ADMIN });
  assert.equal(res.tier, 2);
  assert.equal(res.candidates[0].slotId, '2026-11-25-18');
});

test('Tier 3 returns up to 3 nearest open host slots when zero overlap exists (never empty)', () => {
  const hosts = [{ uid: ADMIN, name: 'Polad', hours: { 1: [10], 2: [10], 3: [10], 4: [10] }, maxPerDay: 2, minLeadHours: 2, isFounder: true }];
  const learner = {
    uid: 'new3', minor: false, timeZone: 'Asia/Baku',
    availability: [{ day: 6, startMin: 23 * 60, endMin: 24 * 60 }],
  };
  const res = planInstantMatch({ learner, hosts, nowMs: NOW, adminUid: ADMIN });
  assert.equal(res.tier, 3);
  assert.equal(res.candidates.length, 0);
  assert.equal(res.alternatives.length, 3);
  assert.equal(res.alternatives[0].slotId, '2026-11-23-10');
});

test('under18 learner only matches official admin/team host, never external adult Verified Partner', () => {
  const hosts = [
    { uid: 'vp_adult', name: 'Sabina', hours: { 1: [18] }, maxPerDay: 2, minLeadHours: 2, isFounder: false, minor: false },
    { uid: ADMIN, name: 'Polad', hours: { 1: [19] }, maxPerDay: 2, minLeadHours: 2, isFounder: true, minor: false },
  ];
  const learner = {
    uid: 'teen1', minor: true, timeZone: 'Asia/Baku',
    availability: [{ day: 1, startMin: 18 * 60, endMin: 20 * 60 }],
  };
  const res = planInstantMatch({ learner, hosts, nowMs: NOW, adminUid: ADMIN });
  assert.equal(res.tier, 1);
  assert.equal(res.candidates.every((c) => c.hostUid === ADMIN), true);
});

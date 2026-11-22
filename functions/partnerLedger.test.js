const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FIRST_PARTNER_MIN_SEC, ATTRIBUTION_WINDOW_MS,
  shouldStampFirstPartner, buildReferralView, evaluateFirstPurchaseCredit,
} = require('./partnerLedger');

const NOW = Date.parse('2026-11-22T12:00:00Z');

test('shouldStampFirstPartner requires >= 5 min call, active partner, and empty firstPartnerUid (immutable)', () => {
  assert.equal(FIRST_PARTNER_MIN_SEC, 300);
  assert.equal(shouldStampFirstPartner({
    learner: {}, partnerUid: 'p1', callSeconds: 300, activePartnerUids: ['p1'],
  }), true);
  // Too short (< 5 min)
  assert.equal(shouldStampFirstPartner({
    learner: {}, partnerUid: 'p1', callSeconds: 299, activePartnerUids: ['p1'],
  }), false);
  // Already stamped → immutable
  assert.equal(shouldStampFirstPartner({
    learner: { firstPartnerUid: 'p0' }, partnerUid: 'p1', callSeconds: 600, activePartnerUids: ['p1'],
  }), false);
  // Not an active partner
  assert.equal(shouldStampFirstPartner({
    learner: {}, partnerUid: 'random', callSeconds: 600, activePartnerUids: ['p1'],
  }), false);
});

test('buildReferralView exposes ONLY firstName and joinedPackage (no phone, email, package or amount)', () => {
  const row = buildReferralView({ learnerName: 'Khadija Mammadova', callAtMs: NOW, joinedPackage: true, joinedAtMs: NOW + 1000 });
  assert.deepEqual(Object.keys(row).sort(), ['callAtMs', 'firstName', 'joinedAtMs', 'joinedPackage']);
  assert.equal(row.firstName, 'Khadija');
  assert.equal(row.joinedPackage, true);
});

test('evaluateFirstPurchaseCredit enforces 14-day window, first purchase only, and payouts OFF default', () => {
  const user = { firstPartnerUid: 'p1', firstPartnerAt: NOW - 3 * 86400000 };
  // Payouts OFF → records policy_pending with 0 credited AZN
  const off = evaluateFirstPurchaseCredit({ user, hadPriorPackage: false, priceAzn: 10, partnerConfig: { payoutEnabled: false }, nowMs: NOW });
  assert.equal(off.eligible, true);
  assert.equal(off.amountAzn, 0);
  assert.equal(off.pendingAzn, 5);
  assert.equal(off.status, 'policy_pending');

  // Payouts ON → credits 50% (5 AZN on 10 AZN package)
  const on = evaluateFirstPurchaseCredit({ user, hadPriorPackage: false, priceAzn: 10, partnerConfig: { payoutEnabled: true, sharePct: 50 }, nowMs: NOW });
  assert.equal(on.eligible, true);
  assert.equal(on.amountAzn, 5);
  assert.equal(on.status, 'credited');

  // Second purchase never credits again
  const repeat = evaluateFirstPurchaseCredit({ user, hadPriorPackage: true, priceAzn: 10, partnerConfig: { payoutEnabled: true }, nowMs: NOW });
  assert.equal(repeat.eligible, false);
  assert.equal(repeat.reason, 'not-first-purchase');

  // Past 14 days → ineligible
  const late = evaluateFirstPurchaseCredit({
    user: { firstPartnerUid: 'p1', firstPartnerAt: NOW - ATTRIBUTION_WINDOW_MS - 1000 },
    hadPriorPackage: false, priceAzn: 10, partnerConfig: { payoutEnabled: true }, nowMs: NOW,
  });
  assert.equal(late.eligible, false);
  assert.equal(late.reason, 'outside-window');
});

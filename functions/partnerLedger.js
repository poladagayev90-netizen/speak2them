// ── Verified Partner ledger & attribution (Phase 2 data model, 2026-11-22) ──
// Pure helpers; index.js performs all Firestore writes server-side only.
//
// Policy rules (Polad 2026-11-22):
//   • users/{uid}.firstPartnerUid is server-only and IMMUTABLE once set.
//   • Set only after the learner's first attended call >= 5 min (300 s,
//     trustedCallSeconds) with an active Verified Partner / host.
//   • "Points" = real money paid manually to the partner's card by admin;
//     partnerLedger is purely a transparent record of owed vs paid.
//   • Payouts stay OFF (appConfig/partners.payoutEnabled === false) until
//     the 50% policy is finalised; entries still track referrals honestly.
//   • Partner status view privacy: firstName + joinedPackage (yes/no) ONLY.
//     Never phone, never email, never package size, never amount.

const FIRST_PARTNER_MIN_SEC = 300; // 5 minutes (trustedCallSeconds)
const ATTRIBUTION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const DEFAULT_SHARE_PCT = 50;

const msOf = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return 0;
};

const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || 'Learner';

// Should this call stamp `firstPartnerUid` on `learner`?
function shouldStampFirstPartner({ learner = {}, partnerUid, callSeconds, activePartnerUids = [] }) {
  if (!partnerUid || !activePartnerUids.includes(partnerUid)) return false;
  if (learner.firstPartnerUid) return false; // immutable once set
  if ((Number(callSeconds) || 0) < FIRST_PARTNER_MIN_SEC) return false;
  return true;
}

// Privacy-safe referral document readable by the Verified Partner.
// Strictly firstName + joinedPackage boolean + call timestamp — NEVER amount,
// package name/size, email, or phone number.
function buildReferralView({ learnerName, callAtMs, joinedPackage = false, joinedAtMs = null }) {
  return {
    firstName: firstNameOf(learnerName),
    callAtMs: Number(callAtMs) || 0,
    joinedPackage: joinedPackage === true,
    ...(joinedPackage && joinedAtMs ? { joinedAtMs: Number(joinedAtMs) } : {}),
  };
}

// Evaluate partner attribution when a learner gets their FIRST-EVER package.
// Returns { eligible, reason?, amountAzn, sharePct, status }.
function evaluateFirstPurchaseCredit({
  user = {},
  hadPriorPackage = false,
  priceAzn = 0,
  partnerConfig = {},
  nowMs = Date.now(),
}) {
  const partnerUid = user.firstPartnerUid || null;
  if (!partnerUid) return { eligible: false, reason: 'no-partner' };
  if (hadPriorPackage) return { eligible: false, reason: 'not-first-purchase' };
  const firstAt = msOf(user.firstPartnerAt);
  if (!firstAt || nowMs - firstAt > ATTRIBUTION_WINDOW_MS) {
    return { eligible: false, reason: 'outside-window' };
  }
  const payoutEnabled = partnerConfig.payoutEnabled === true;
  const sharePct = Number(partnerConfig.sharePct) > 0 && Number(partnerConfig.sharePct) <= 100
    ? Number(partnerConfig.sharePct)
    : DEFAULT_SHARE_PCT;
  const price = Math.max(0, Number(priceAzn) || 0);
  const computed = Math.round((price * sharePct) / 100 * 100) / 100;
  return {
    eligible: true,
    partnerUid,
    sharePct,
    amountAzn: payoutEnabled ? computed : 0,
    pendingAzn: payoutEnabled ? 0 : computed,
    status: payoutEnabled ? 'credited' : 'policy_pending',
  };
}

module.exports = {
  FIRST_PARTNER_MIN_SEC, ATTRIBUTION_WINDOW_MS, DEFAULT_SHARE_PCT,
  firstNameOf, shouldStampFirstPartner, buildReferralView, evaluateFirstPurchaseCredit,
};

// ── Practice packages (2026-10-04) ─────────────────────────────────
// What a learner pays for is PLANNED PRACTICES a month (8 / 12 / 16 / 20),
// not minutes: minutes are invisible to a learner and a partner who does not
// come would "use up" time they never got. Calls with a friend and AInur stay
// free — they cost us almost nothing and keep the app alive.
//
// Nothing here is stored as a counter. The balance is DERIVED from the
// learner's bookings every time, so a practice the platform failed to deliver
// (partner did not come, nobody was found, someone else cancelled) simply
// stops counting — the "refund" needs no separate write that could be lost.
//
// Pure: no Firestore here. index.js reads the docs and calls these.
// src/utils/packages.js mirrors the display half — keep them in step.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

const DEFAULT_PACKAGES = [
  { size: 8, price: 6, productId: 'practice_8' },
  { size: 12, price: 8, productId: 'practice_12' },
  { size: 16, price: 10, productId: 'practice_16' },
  { size: 20, price: 12, productId: 'practice_20' },
];

const msOf = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  if (typeof v === 'string') return Date.parse(v) || 0;
  return 0;
};

// appConfig/billing merged over the defaults. `enforce` is OFF until the
// admin switches it on; `enabledAt` is when that first happened.
function billingConfig(raw = {}) {
  const r = raw || {};
  const packages = Array.isArray(r.packages) && r.packages.length
    ? r.packages.filter((p) => Number(p.size) > 0).map((p) => ({
      size: Number(p.size), price: Number(p.price) || 0, productId: p.productId || `practice_${p.size}`,
    }))
    : DEFAULT_PACKAGES;
  return {
    enforce: r.enforce === true,
    enabledAtMs: msOf(r.enabledAt) || null,
    trialWeeks: Number(r.trialWeeks) > 0 ? Number(r.trialWeeks) : 4,
    trialPerWeek: Number(r.trialPerWeek) > 0 ? Number(r.trialPerWeek) : 2,
    periodDays: Number(r.periodDays) > 0 ? Number(r.periodDays) : 30,
    carryMax: r.carryMax != null && Number.isFinite(Number(r.carryMax)) ? Math.max(0, Number(r.carryMax)) : 4,
    currency: r.currency || 'AZN',
    packages,
  };
}

// Monday 00:00 Baku of the week `ms` falls in (Baku has no DST).
function weekStartMs(ms) {
  const d = new Date(ms + BAKU_OFFSET_MS);
  const back = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back) - BAKU_OFFSET_MS;
}

// How one booking counts for one person:
//   used      — the practice happened, or they did not come / cancelled late
//   reserved  — still ahead (confirmed)
//   returned  — the platform or someone else let them down; it does not count
//   null      — not theirs, or moved (the booking it moved to counts instead)
function bookingVerdict(b, uid) {
  if (!b || !(b.participants || []).includes(uid)) return null;
  if (b.status === 'confirmed') return 'reserved';
  if (b.status === 'done') {
    const o = (b.outcome || {})[uid];
    return o === 'attended' || o === 'no_show' ? 'used' : 'returned';
  }
  if (b.status === 'cancelled') return b.cancelledBy === uid && b.late === true ? 'used' : 'returned';
  return null;
}

function practiceUse(bookings, uid, fromMs = -Infinity, toMs = Infinity) {
  const out = { used: 0, reserved: 0, returned: 0 };
  for (const b of bookings || []) {
    const at = Number(b.startMs) || 0;
    if (at < fromMs || at >= toMs) continue;
    const v = bookingVerdict(b, uid);
    if (v) out[v] += 1;
  }
  return out;
}

// No package needed: the admin, "Make Pro", a course member, a learner whose
// teacher's lessons gave them free access, or any plan other than trial/free.
// The same exemptions the old isTrialExpired had.
function isUnlimited(user, uid, adminUid, nowMs = Date.now()) {
  if (adminUid && uid === adminUid) return true;
  const u = user || {};
  if (u.isPremium === true) return true;
  if (['pending', 'accepted', 'active'].includes(u.cohortStatus)) return true;
  if (msOf(u.freeAccessUntil) > nowMs) return true;
  if (u.subscriptionPlan && u.subscriptionPlan !== 'trial' && u.subscriptionPlan !== 'free') return true;
  return false;
}

// The free weeks start at sign-up — or at the day the rules were switched
// on, whichever is later, so nobody who joined months ago wakes up blocked.
function trialWindow(user, config) {
  const u = user || {};
  const signup = msOf(u.trialStartedAt) || msOf(u.createdAt) || 0;
  const startMs = Math.max(signup, config.enabledAtMs || 0);
  return { startMs, endMs: startMs + config.trialWeeks * WEEK_MS };
}

function activePackage(accessDoc, nowMs) {
  const p = accessDoc && accessDoc.package;
  if (!p || !(Number(p.size) > 0)) return null;
  const startsMs = msOf(p.startsAt);
  const endsMs = msOf(p.endsAt);
  if (!(endsMs > nowMs) || startsMs > nowMs) return null;
  return { size: Number(p.size), carriedIn: Number(p.carriedIn) || 0, startsMs, endsMs, source: p.source || 'admin' };
}

// Where one person stands now.
//   unlimited — nothing is counted
//   package   — size + carriedIn − used − reserved left until endsMs
//   trial     — trialPerWeek a week until trialEndsMs
//   none      — trial over, no package
function accessState({ uid, user, accessDoc, config, bookings, nowMs = Date.now(), adminUid = null }) {
  const cfg = config || billingConfig();
  if (isUnlimited(user, uid, adminUid, nowMs)) return { kind: 'unlimited', remaining: null };
  const pkg = activePackage(accessDoc, nowMs);
  if (pkg) {
    const use = practiceUse(bookings, uid, pkg.startsMs, pkg.endsMs);
    const total = pkg.size + pkg.carriedIn;
    return {
      kind: 'package', size: pkg.size, carriedIn: pkg.carriedIn, total,
      ...use, remaining: Math.max(0, total - use.used - use.reserved),
      periodStartMs: pkg.startsMs, periodEndMs: pkg.endsMs,
    };
  }
  const trial = trialWindow(user, cfg);
  if (nowMs < trial.endMs) {
    const wk = weekStartMs(nowMs);
    const use = practiceUse(bookings, uid, wk, wk + WEEK_MS);
    return {
      kind: 'trial', perWeek: cfg.trialPerWeek, trialEndsMs: trial.endMs,
      ...use, remaining: Math.max(0, cfg.trialPerWeek - use.used - use.reserved),
    };
  }
  return { kind: 'none', remaining: 0, trialEndsMs: trial.endMs };
}

// How many more practices may be booked in the week starting `weekMs`
// (the weekly planner drafts NEXT week, so "now" is not enough).
function allowanceForWeek(state, weekMs, bookings, uid) {
  if (!state) return 0;
  if (state.kind === 'unlimited') return Infinity;
  if (state.kind === 'package') return weekMs >= state.periodEndMs ? 0 : state.remaining;
  if (state.kind === 'trial') {
    if (weekMs >= state.trialEndsMs) return 0;
    const use = practiceUse(bookings, uid, weekMs, weekMs + WEEK_MS);
    return Math.max(0, state.perWeek - use.used - use.reserved);
  }
  return 0;
}

// May this person take one more planned practice that starts at `startMs`?
function canBookAt(state, startMs, bookings, uid) {
  if (state && state.kind === 'package' && startMs >= state.periodEndMs) return false;
  return allowanceForWeek(state, weekStartMs(startMs), bookings, uid) > 0;
}

// A new package. Bought while the old one runs: everything left moves over
// (it was paid for). Bought within a period after it ended: only what the
// platform failed to deliver moves over, capped at carryMax.
function grantPackage({ size, nowMs = Date.now(), config, previous = null, source = 'admin', ref = null }) {
  const cfg = config || billingConfig();
  const n = Number(size);
  if (!cfg.packages.some((p) => p.size === n)) throw new Error('unknown-package');
  let carriedIn = 0;
  if (previous && previous.kind === 'package') {
    if (nowMs < previous.periodEndMs) carriedIn = previous.remaining;
    else if (nowMs < previous.periodEndMs + cfg.periodDays * DAY_MS) {
      carriedIn = Math.min(previous.returned, previous.remaining, cfg.carryMax);
    }
  }
  return {
    size: n, carriedIn,
    startsMs: nowMs, endsMs: nowMs + cfg.periodDays * DAY_MS,
    source, ref,
  };
}

// The short version the learner's app reads from planStatus/{uid}.access.
function accessSummary(state) {
  if (!state) return null;
  const keep = ['kind', 'remaining', 'size', 'carriedIn', 'total', 'used', 'reserved', 'returned',
    'periodStartMs', 'periodEndMs', 'perWeek', 'trialEndsMs'];
  const out = {};
  for (const k of keep) {
    if (state[k] === undefined) continue;
    out[k] = state[k] === Infinity ? null : state[k];
  }
  return out;
}

module.exports = {
  DEFAULT_PACKAGES, WEEK_MS, DAY_MS,
  billingConfig, weekStartMs, bookingVerdict, practiceUse, isUnlimited, trialWindow,
  activePackage, accessState, allowanceForWeek, canBookAt, grantPackage, accessSummary,
};

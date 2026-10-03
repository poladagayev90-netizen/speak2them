import { ADMIN_UID } from '../constants';

// Practice packages — the display half of functions/packages.js (keep the
// two in step). The server derives the balance from bookings and writes a
// short summary to planStatus/{uid}.access; this file only reads that, and
// falls back to the user doc when no summary has been written yet.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const DEFAULT_PACKAGES = [
  { size: 8, price: 6, productId: 'practice_8' },
  { size: 12, price: 8, productId: 'practice_12' },
  { size: 16, price: 10, productId: 'practice_16' },
  { size: 20, price: 12, productId: 'practice_20' },
];

const msOf = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

export function billingConfig(raw = {}) {
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
    carryMax: r.carryMax != null && Number.isFinite(Number(r.carryMax)) ? Math.max(0, Number(r.carryMax)) : 4,
    currency: r.currency || 'AZN',
    packages,
  };
}

// The same exemptions as the server's isUnlimited.
export function isUnlimited(user, nowMs = Date.now()) {
  const u = user || {};
  if ((u.uid || u.id) === ADMIN_UID) return true;
  if (u.isPremium === true) return true;
  if (['pending', 'accepted', 'active'].includes(u.cohortStatus)) return true;
  if (msOf(u.freeAccessUntil) > nowMs) return true;
  if (u.subscriptionPlan && u.subscriptionPlan !== 'trial' && u.subscriptionPlan !== 'free') return true;
  return false;
}

export function trialEndsMs(user, config) {
  const u = user || {};
  const signup = msOf(u.trialStartedAt) || msOf(u.createdAt) || 0;
  return Math.max(signup, config.enabledAtMs || 0) + config.trialWeeks * WEEK_MS;
}

// Where the learner stands, for the screen.
export function packageView({ user, summary, config, nowMs = Date.now() }) {
  const cfg = config || billingConfig();
  if (isUnlimited(user, nowMs)) return { kind: 'unlimited' };
  const s = summary || null;
  if (s && s.kind === 'package' && s.periodEndMs > nowMs) {
    return { ...s, kind: 'package' };
  }
  const ends = trialEndsMs(user, cfg);
  if (nowMs < ends) {
    const fresh = s && s.kind === 'trial';
    return {
      kind: 'trial', perWeek: cfg.trialPerWeek, trialEndsMs: ends,
      used: fresh ? s.used || 0 : 0,
      reserved: fresh ? s.reserved || 0 : 0,
      returned: fresh ? s.returned || 0 : 0,
      remaining: fresh ? s.remaining : cfg.trialPerWeek,
    };
  }
  return { kind: 'none', remaining: 0, trialEndsMs: ends };
}

// Profile shows "Your plan" once there is something to show: a package, or
// the free weeks are over and the rules are on. Never during the free weeks.
export function showPlanEntry(view, config, isAdmin = false) {
  if (isAdmin) return true;
  if (!view) return false;
  if (view.kind === 'package') return true;
  return view.kind === 'none' && !!(config && config.enforce);
}

// Only when the limits are real and nothing is left: one quiet line.
export function outOfPractices(view, config) {
  return !!(config && config.enforce && view && (view.kind === 'none' || (view.kind === 'package' && view.remaining <= 0)));
}

export const perPractice = (p) => (p.size ? p.price / p.size : 0);

export const formatPrice = (n) => (Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2);

// Roughly how many a week a month's package gives.
export const perWeekOf = (size) => Math.round(size / 4);

// The package that fits the week the learner chose in onboarding.
export function fitsWeek(packages, weeklyTarget) {
  const want = Math.max(1, Number(weeklyTarget) || 0) * 4;
  const list = [...(packages || [])].sort((a, b) => a.size - b.size);
  if (!list.length) return null;
  return (list.find((p) => p.size >= want) || list[list.length - 1]).size;
}

export function packageMessage({ name, size, price, currency = 'AZN' }) {
  const who = name ? `Hi! I'm ${name}. ` : 'Hi! ';
  return `${who}I'd like the ${size}-practice package (${formatPrice(price)} ${currency}) on SpeakLab.`;
}

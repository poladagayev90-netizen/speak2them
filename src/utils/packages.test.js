import {
  billingConfig, isUnlimited, packageView, showPlanEntry, outOfPractices, fitsWeek, perPractice, formatPrice,
} from './packages';
import { ADMIN_UID } from '../constants';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-21T12:00:00+04:00');
const cfg = billingConfig({});

test('defaults: switched off, 4=6, 8=10, 12 locked with hidden price', () => {
  expect(cfg.enforce).toBe(false);
  expect(cfg.packages.map((p) => [p.size, p.price, !!p.locked])).toEqual([
    [4, 6, false],
    [8, 10, false],
    [12, null, true],
  ]);
});

test('unlimited mirrors the server', () => {
  expect(isUnlimited({ uid: ADMIN_UID }, NOW)).toBe(true);
  expect(isUnlimited({ isPremium: true }, NOW)).toBe(true);
  expect(isUnlimited({ freeAccessUntil: NOW + DAY }, NOW)).toBe(true);
  expect(isUnlimited({ subscriptionPlan: 'trial' }, NOW)).toBe(false);
});

test('three free practices, then none; a live package wins', () => {
  const fresh = { trialStartedAt: NOW - 3 * DAY };
  expect(packageView({ user: fresh, config: cfg, nowMs: NOW })).toMatchObject({ kind: 'trial', remaining: 3 });
  expect(packageView({ user: fresh, summary: { kind: 'trial', remaining: 1, used: 2 }, config: cfg, nowMs: NOW })).toMatchObject({ kind: 'trial', remaining: 1 });
  const old = { trialStartedAt: NOW - 90 * DAY };
  expect(packageView({ user: old, summary: { kind: 'none', remaining: 0 }, config: cfg, nowMs: NOW }).kind).toBe('none');
  const summary = { kind: 'package', remaining: 5, total: 8, periodEndMs: NOW + DAY };
  expect(packageView({ user: old, summary, config: cfg, nowMs: NOW })).toMatchObject({ kind: 'package', remaining: 5 });
  expect(packageView({ user: old, summary: { ...summary, periodEndMs: NOW - 1 }, config: cfg, nowMs: NOW }).kind).toBe('none');
});

test('the plan entry stays hidden during the free weeks', () => {
  const on = billingConfig({ enforce: true });
  expect(showPlanEntry({ kind: 'trial' }, on)).toBe(false);
  expect(showPlanEntry({ kind: 'none' }, cfg)).toBe(false);
  expect(showPlanEntry({ kind: 'none' }, on)).toBe(true);
  expect(showPlanEntry({ kind: 'package' }, cfg)).toBe(true);
  expect(showPlanEntry({ kind: 'trial' }, cfg, true)).toBe(true);
  expect(outOfPractices({ kind: 'package', remaining: 0 }, on)).toBe(true);
  expect(outOfPractices({ kind: 'package', remaining: 0 }, cfg)).toBe(false);
});

test('the package that fits the chosen week (skips locked packages)', () => {
  expect(fitsWeek(cfg.packages, 1)).toBe(4);
  expect(fitsWeek(cfg.packages, 2)).toBe(8);
  expect(fitsWeek(cfg.packages, 3)).toBe(8);
  expect(fitsWeek(cfg.packages, 5)).toBe(8);
  expect(formatPrice(perPractice({ size: 4, price: 6 }))).toBe('1.50');
  expect(formatPrice(perPractice({ size: 8, price: 10 }))).toBe('1.25');
  expect(perPractice({ size: 12, price: null, locked: true })).toBeNull();
  expect(formatPrice(10)).toBe('10');
});

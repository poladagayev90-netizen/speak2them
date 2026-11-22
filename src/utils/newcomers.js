// Admin → Matching → «Newcomers» (2026-11-15, review
// docs/reviews/2026-11-15_matching_newcomers.md priority 4): everyone who
// joined in the last 14 days, how far each got, and a WhatsApp message from
// Polad in the learner's first-run language. Sending stays manual — the link
// only opens WhatsApp with the text filled in.
//
// The 14-day window and «no first practice» come from `attentionOf`
// (src/utils/matching.js), so this card and the «Needs attention» count agree.
import { attentionOf, NEW_WINDOW_MS, nextLearnerSlots } from './matching';
import { FIRST_RUN_LANGS } from './firstRunLang';
import { newcomerGridMessage, waHref } from './adminMessages';

const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);

export const NEWCOMER_STEPS = [
  ['registered', 'Registered'],
  ['wizard', 'Wizard done'],
  ['whatsapp', 'WhatsApp given'],
  ['warmup', 'Warm-up'],
  ['booked', 'First practice booked'],
  ['practised', 'First practice done'],
];

// `user` = users/{uid}; `ob` = onboarding/{uid} or null (the wizard writes it
// on finish, so a missing doc = wizard not done); `warmedUp` = a
// warmupInsights/{uid} doc exists (written at the end of every warm-up call,
// even a too-short one); `booked` = a booking / proposal of theirs is loaded.
export function newcomerSteps({ user = {}, ob = null, warmedUp = false, booked = false }) {
  const calls = Number(user.callCount) || 0;
  const done = {
    registered: true,
    wizard: !!ob,
    whatsapp: !!String(ob?.whatsapp || '').trim(),
    warmup: !!warmedUp,
    booked: calls > 0 || !!user.upcomingCall || !!booked,
    practised: calls > 0,
  };
  return NEWCOMER_STEPS.map(([key, label]) => ({ key, label, done: done[key] }));
}

// The language Polad writes in: the first-run pick, then the app / report
// language — the same order the warm-up uses (warmupL1). Only az/tr/ru/en.
export function newcomerLang(user = {}) {
  for (const l of [user.guideLanguage, user.appLanguage, user.preferredLanguage]) {
    if (FIRST_RUN_LANGS.includes(l)) return l;
  }
  return 'en';
}

export function newcomerMessage(lang, name = '', practised = false, { slots = [], timeZone = 'Asia/Baku' } = {}) {
  return newcomerGridMessage({ lang, name, practised, slots, timeZone });
}

// wa.me link with the message filled in; null without a usable number.
export function newcomerWhatsApp(number, text) {
  return waHref(number, text);
}

// The card's rows, newest joiner first. `users` = every users doc (with uid or
// id), `onboarding` = Map uid → onboarding doc, `warmups` = Map/Set of uids with
// a warm-up, `bookedUids` = Set of uids with a loaded booking or proposal.
// `skip(user)` leaves out the admin and teachers.
export function newcomerRows({
  users = [], onboarding = new Map(), warmups = new Map(), bookedUids = new Set(),
  pairs = [], week = null, now = Date.now(), skip = () => false,
}) {
  const rows = [];
  for (const u of users) {
    const uid = u.uid || u.id;
    if (!uid || skip(u)) continue;
    const ob = onboarding.get(uid) || null;
    const joinedMs = toMs(u.createdAt) || toMs(ob?.submittedAt);
    const calls = Number(u.callCount) || 0;
    if (!joinedMs || joinedMs <= now - NEW_WINDOW_MS) continue;
    const steps = newcomerSteps({ user: u, ob, warmedUp: warmups.has(uid), booked: bookedUids.has(uid) });
    const lang = newcomerLang(u);
    const name = u.name || u.displayName || '';
    const practised = calls > 0;
    const slots = week && ob
      ? nextLearnerSlots({ onboarding: ob, monday: week, pairs, uid, nowMs: now, count: 2 })
      : [];
    const timeZone = ob?.timeZone || 'Asia/Baku';
    rows.push({
      uid,
      name: name || uid.slice(0, 6),
      level: u.level || ob?.level || null,
      ageBand: ob?.ageBand || null,
      timeZone,
      joinedMs,
      days: Math.max(0, Math.floor((now - joinedMs) / 86400000)),
      seen: toMs(u.lastSeen),
      steps,
      reached: steps.filter((s) => s.done).length,
      noFirst: attentionOf({ calls, joinedMs }, now).newNoFirst,
      lang,
      slots,
      whatsapp: newcomerWhatsApp(ob?.whatsapp, newcomerMessage(lang, name, practised, { slots, timeZone })),
    });
  }
  return rows.sort((a, b) => b.joinedMs - a.joinedMs);
}

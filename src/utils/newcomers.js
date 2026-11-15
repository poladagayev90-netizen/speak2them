// Admin → Matching → «Newcomers» (2026-11-15, review
// docs/reviews/2026-11-15_matching_newcomers.md priority 4): everyone who
// joined in the last 14 days, how far each got, and a WhatsApp message from
// Polad in the learner's first-run language. Sending stays manual — the link
// only opens WhatsApp with the text filled in.
//
// The 14-day window and «no first practice» come from `attentionOf`
// (src/utils/matching.js), so this card and the «Needs attention» count agree.
import { attentionOf, NEW_WINDOW_MS } from './matching';
import { FIRST_RUN_LANGS } from './firstRunLang';

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

// Two short messages: before the first practice (offer to set it up) and
// after it. No hour is named and no fear is named — only what they get.
const MESSAGES = {
  first: {
    az: (n) => `Salam${n ? `, ${n}` : ''}! Mən Polad, SpeakLab-dan. İlk məşqini birlikdə quraq: sənin səviyyəndə, sadə suallarla. Bu həftə hansı gün və saat sənə rahatdır?`,
    tr: (n) => `Merhaba${n ? ` ${n}` : ''}! Ben Polad, SpeakLab'den. İlk pratiğini birlikte ayarlayalım: senin seviyende, basit sorularla. Bu hafta hangi gün ve saat sana uygun?`,
    ru: (n) => `Привет${n ? `, ${n}` : ''}! Я Полад из SpeakLab. Давай вместе назначим твою первую практику: на твоём уровне, с простыми вопросами. Какой день и время на этой неделе тебе удобны?`,
    en: (n) => `Hi${n ? ` ${n}` : ''}! I'm Polad from SpeakLab. Let's set up your first practice together: at your level, with simple questions. Which day and time suit you this week?`,
  },
  after: {
    az: (n) => `Salam${n ? `, ${n}` : ''}! Mən Polad, SpeakLab-dan. İlk məşqin necə keçdi? Növbətini nə vaxt edək?`,
    tr: (n) => `Merhaba${n ? ` ${n}` : ''}! Ben Polad, SpeakLab'den. İlk pratiğin nasıl geçti? Bir sonrakini ne zaman yapalım?`,
    ru: (n) => `Привет${n ? `, ${n}` : ''}! Я Полад из SpeakLab. Как прошла твоя первая практика? Когда сделаем следующую?`,
    en: (n) => `Hi${n ? ` ${n}` : ''}! I'm Polad from SpeakLab. How was your first practice? When shall we do the next one?`,
  },
};

export function newcomerMessage(lang, name = '', practised = false) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  const set = practised ? MESSAGES.after : MESSAGES.first;
  return (set[lang] || set.en)(first);
}

// wa.me link with the message filled in; null without a usable number.
export function newcomerWhatsApp(number, text) {
  const d = String(number || '').replace(/\D/g, '');
  if (!d) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

// The card's rows, newest joiner first. `users` = every users doc (with uid or
// id), `onboarding` = Map uid → onboarding doc, `warmups` = Map/Set of uids with
// a warm-up, `bookedUids` = Set of uids with a loaded booking or proposal.
// `skip(user)` leaves out the admin and teachers.
export function newcomerRows({ users = [], onboarding = new Map(), warmups = new Map(), bookedUids = new Set(), now = Date.now(), skip = () => false }) {
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
    rows.push({
      uid,
      name: name || uid.slice(0, 6),
      level: u.level || ob?.level || null,
      joinedMs,
      days: Math.max(0, Math.floor((now - joinedMs) / 86400000)),
      seen: toMs(u.lastSeen),
      steps,
      reached: steps.filter((s) => s.done).length,
      noFirst: attentionOf({ calls, joinedMs }, now).newNoFirst,
      lang,
      whatsapp: newcomerWhatsApp(ob?.whatsapp, newcomerMessage(lang, name, practised)),
    });
  }
  return rows.sort((a, b) => b.joinedMs - a.joinedMs);
}

// The language of the FIRST RUN — sign-up, the onboarding wizard, /intro and
// the first Today tour (Polad 2026-10-14: a newcomer at A1–A2 answered the
// wizard in English and half the answers meant something else; the
// availability-vs-target difference above all).
//
// Everything after that stays English (see feedbackLanguage.js) — the first
// run is the one place where a misunderstood question costs a real practice.
// The words live in src/data/firstRunCopy.js.
//
// Resolution: the learner's own pick on the register screen (localStorage),
// then the device language, then English. Russian is here and NOT in the
// feedback languages: the analysis and word meanings are az/tr only, so a
// Russian pick changes the first run and nothing else.

import { LANG_STORAGE_KEY } from './feedbackLanguage';

export const FIRST_RUN_LANGS = ['az', 'tr', 'ru', 'en'];
export const FIRST_RUN_LANG_KEY = 'sl.firstRunLang';

export const FIRST_RUN_LANG_NAMES = {
  az: 'Azərbaycanca',
  tr: 'Türkçe',
  ru: 'Русский',
  en: 'English',
};

// navigator.languages-like list → the first one we support, else 'en'.
export function pickFirstRunLang(tags) {
  for (const tag of tags || []) {
    const base = String(tag || '').toLowerCase().split('-')[0];
    if (FIRST_RUN_LANGS.includes(base)) return base;
  }
  return 'en';
}

// `userLang` = users.guideLanguage, for a learner who signed up on another
// device (the wizard can open on a new phone).
export function resolveFirstRunLang(userLang) {
  try {
    const chosen = localStorage.getItem(FIRST_RUN_LANG_KEY);
    if (FIRST_RUN_LANGS.includes(chosen)) return chosen;
  } catch { /* private mode */ }
  if (FIRST_RUN_LANGS.includes(userLang)) return userLang;
  try {
    return pickFirstRunLang([...(navigator.languages || []), navigator.language]);
  } catch {
    return 'en';
  }
}

export function storeFirstRunLang(lang) {
  if (!FIRST_RUN_LANGS.includes(lang)) return;
  try {
    localStorage.setItem(FIRST_RUN_LANG_KEY, lang);
    // az/tr are also the feedback language on this device (the key
    // feedbackLanguage.js and appLanguage.js read), as languageFields() writes.
    if (lang === 'az' || lang === 'tr') localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch { /* private mode */ }
}

// What the sign-up writes on the users doc. az/tr also become the feedback
// language (the same two fields Profile → Language writes), so the first
// report and the word meanings already speak it; ru and en leave that alone.
export function languageFields(lang) {
  if (!FIRST_RUN_LANGS.includes(lang)) return {};
  return lang === 'az' || lang === 'tr'
    ? { guideLanguage: lang, preferredLanguage: lang, appLanguage: lang }
    : { guideLanguage: lang };
}

// The first day in the app: no streak celebration and no «Today's topic»
// pop-up on top of the tour (Polad 2026-10-14). An account younger than a day,
// or one that has never practised and has no streak to celebrate yet.
const DAY_MS = 24 * 60 * 60 * 1000;
function millis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return typeof v === 'number' ? v : 0;
}
export function isFirstDay(user, now = Date.now()) {
  if (!user) return false;
  const created = millis(user.createdAt);
  if (created && now - created < DAY_MS) return true;
  return !created && !(Number(user.callCount) > 0);
}

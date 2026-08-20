// Feedback language.
//
// The interface itself is English -- if you are learning a language you can
// read "Continue" and "Next picture", and keeping one language removes a whole
// class of localisation bugs. But an ERROR EXPLANATION is different: the
// language there is the payload, not the wrapper. Telling a B1 learner in
// English why their English was wrong is circular, and that is exactly the
// sentence they will misread. So analysis reports stay in the learner's own
// language, and this is where that choice lives.
//
// Storage key is unchanged from the old i18n module on purpose -- existing
// users keep the language they already picked.

export const LANG_STORAGE_KEY = 'speaklab_lang';

export const FEEDBACK_LANGUAGES = [
  { code: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

const SUPPORTED = FEEDBACK_LANGUAGES.map((l) => l.code);

export function getFeedbackLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (SUPPORTED.includes(stored)) return stored;
  } catch {
    // private mode / storage disabled -- fall through to the default
  }
  return 'az';
}

export function setFeedbackLanguage(code) {
  const next = SUPPORTED.includes(code) ? code : 'az';
  try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch { /* ignore */ }
  return next;
}

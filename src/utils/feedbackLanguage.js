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

// The device's own language, when it is one we can write feedback in. Kept
// local rather than imported from appLanguage.js: that module imports THIS one
// for the storage key, and pointing them at each other would be a cycle.
function deviceFeedbackLanguage() {
  try {
    const tags = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ].filter(Boolean);
    for (const tag of tags) {
      const base = String(tag).toLowerCase().split('-')[0];
      if (SUPPORTED.includes(base)) return base;
    }
  } catch {
    // no navigator (SSR, odd WebView) -- fall through
  }
  return null;
}

export function getFeedbackLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (SUPPORTED.includes(stored)) return stored;
  } catch {
    // private mode / storage disabled -- fall through to the device
  }
  // Falling straight to 'az' here meant a Turkish learner who never opened
  // Profile > Language read their report, and the concept names in the progress
  // room, in Azerbaijani -- while their notifications were already correctly
  // Turkish, because those resolve from the device. The two now agree.
  // Anything other than az/tr still lands on 'az': the report itself can only
  // be written in those two, so pretending otherwise here would label a screen
  // in a language the content is not in.
  return deviceFeedbackLanguage() || 'az';
}

export function setFeedbackLanguage(code) {
  const next = SUPPORTED.includes(code) ? code : 'az';
  try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch { /* ignore */ }
  return next;
}

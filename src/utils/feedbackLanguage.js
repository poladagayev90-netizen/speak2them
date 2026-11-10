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

// The languages a REPORT can be written in (Profile → Feedback language).
// ru was added 2026-11-10. It is a report language only: word meanings, concept
// names and glossaries exist in az and tr alone, so everything that LOOKS UP
// content by language keeps using getFeedbackLanguage() (az | tr), and only
// the language picker and the report itself read getReportLanguage().
export const FEEDBACK_LANGUAGES = [
  { code: 'az', label: 'Azərbaycan' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
];

const REPORT_LANGUAGES = FEEDBACK_LANGUAGES.map((l) => l.code);
// Languages the in-app content (meanings, concept names) is written in.
const SUPPORTED = ['az', 'tr'];

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

// The report language the learner chose (az | tr | ru). Someone who chose ru
// still reads word meanings through getFeedbackLanguage(), which falls back to
// their device language or az.
export function getReportLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (REPORT_LANGUAGES.includes(stored)) return stored;
  } catch {
    // private mode / storage disabled -- fall through
  }
  return getFeedbackLanguage();
}

export function setFeedbackLanguage(code) {
  const next = REPORT_LANGUAGES.includes(code) ? code : 'az';
  try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch { /* ignore */ }
  return next;
}

// The learner-language meaning of a vocabulary or idiom entry.
//
// Every entry in weeklyContent.js carries both meaningAZ and meaningTR. Before
// this existed the cards printed meaningAZ unconditionally, so a Turkish
// learner read the English definition and an Azerbaijani one under it. The
// fallbacks matter: older decks (chapterStories.js) only ever had AZ, and a
// missing translation must show the other language rather than an empty line.
export function localMeaning(item, lang = getFeedbackLanguage()) {
  if (!item) return '';
  const first = lang === 'tr' ? item.meaningTR : item.meaningAZ;
  return first || item.meaningAZ || item.meaningTR || '';
}

'use strict';

// The language a learner's analysis report is written in (their L1).
//
// az and tr were the only two until 2026-11-10; ru was added for the
// Russian-speaking learners in Baku. Each language needs real orthographic
// anchors in the prompt (LANGUAGE_GUIDE in index.js) — a bare language name
// makes the model invent spelling — so a code is only listed here once those
// anchors exist.
const REPORT_LANGUAGES = ['az', 'tr', 'ru'];

// Which language to write the report in, from the users doc.
//
// `preferredLanguage` is written only by an explicit choice (Profile → Feedback
// language, or the first-run language picker), so it always wins: someone on a
// Turkish phone who chose Azerbaijani wants Azerbaijani. `appLanguage` comes
// from the device and fills the gap for people who never chose — but only for
// tr: it is never 'ru' (notifications have no Russian copy, so the app does not
// record it), and an 'en' device still gets the default.
function reportLanguageFor(userData) {
  const u = userData || {};
  if (REPORT_LANGUAGES.includes(u.preferredLanguage)) return u.preferredLanguage;
  if (u.appLanguage === 'tr') return 'tr';
  return 'az';
}

// DeepSeek sometimes drops a word from another writing system into the middle
// of a report (seen in production: Chinese characters inside a Turkish
// sentence). The prompt forbids it, but only this check guarantees it.
// Cyrillic is foreign in an az/tr report and is the script itself in a ru one,
// so the pattern depends on the language.
const CJK_ARABIC = '぀-ヿ㐀-䶿一-鿿가-힯؀-ۿ';
const CYRILLIC = 'Ѐ-ӿ';
const FOREIGN_SCRIPT = {
  default: new RegExp(`[${CJK_ARABIC}${CYRILLIC}]`),
  ru: new RegExp(`[${CJK_ARABIC}]`),
};

function hasForeignScript(value, lang = 'az') {
  const re = FOREIGN_SCRIPT[lang] || FOREIGN_SCRIPT.default;
  return re.test(JSON.stringify(value || ''));
}

// The scripts to name in the "rewrite it" retry, matching the check above.
function foreignScriptNames(lang = 'az') {
  return lang === 'ru'
    ? 'Chinese/Japanese/Korean/Arabic'
    : 'Chinese/Japanese/Korean/Arabic/Cyrillic';
}

module.exports = { REPORT_LANGUAGES, reportLanguageFor, hasForeignScript, foreignScriptNames };

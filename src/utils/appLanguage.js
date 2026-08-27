// App language — the language NOTIFICATIONS are written in.
//
// This is not the same question as the feedback language. The interface is
// English on purpose (see feedbackLanguage.js), and the analysis report is
// written in the learner's L1 (az/tr only, because those are the two the
// analysis prompt has real orthographic anchors for). A push notification is a
// third thing again: it is short, it arrives on a locked screen, and it should
// read in whatever language the person actually thinks in.
//
// Until now every push was hardcoded Azerbaijani, so a Turkish user who had
// already chosen Turkish feedback still got Azerbaijani notifications, and an
// English-speaking user got Azerbaijani too. This resolves what to send:
//
//   1. an explicit feedback-language choice (az/tr) — they told us
//   2. the device language, when it is one we support
//   3. English, for any other device language
//
// Rule 2 is what fixes the English case without adding another setting: a
// phone set to English has effectively already answered the question. The
// value is written to users/{uid}.appLanguage, which functions/pushText.js
// reads. Note the DEFAULT still differs by side: the server falls back to 'az'
// when the field is absent (existing users, no device signal at all), while a
// device that reports an unsupported locale is recorded as 'en'.

import { LANG_STORAGE_KEY } from './feedbackLanguage';

export const APP_LANGUAGES = ['az', 'tr', 'en'];

// The device's own language, narrowed to what we support.
function deviceLanguage() {
  try {
    const tags = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
    ].filter(Boolean);
    for (const tag of tags) {
      const base = String(tag).toLowerCase().split('-')[0];
      if (APP_LANGUAGES.includes(base)) return base;
    }
  } catch {
    // no navigator (SSR, odd WebView) — fall through
  }
  return 'en';
}

export function resolveAppLanguage() {
  try {
    const chosen = localStorage.getItem(LANG_STORAGE_KEY);
    // An explicit choice always wins: someone on an English phone who picked
    // Azerbaijani feedback wants Azerbaijani.
    if (chosen === 'az' || chosen === 'tr') return chosen;
  } catch {
    // private mode / storage disabled — fall through to the device
  }
  return deviceLanguage();
}

// The device's IANA timezone, e.g. "Europe/Istanbul".
//
// The server needs this to print an appointment time a push recipient will
// recognise. The schedule is authored in Baku, so a Turkish student's 14:00
// block is 13:00 on their own phone — and the practice board already shows
// them 13:00. Without this field the notification for that same call said
// 14:00. Returns null when the browser cannot tell us; the server then falls
// back to Baku.
export function deviceTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.includes('/') ? tz : null;
  } catch {
    return null;
  }
}

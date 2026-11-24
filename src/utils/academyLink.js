import { getFeedbackLanguage } from './feedbackLanguage';
import { markAcademyOpened } from './academyPopup';

// SpeakLab Academy — video guides to the app.
//
// In-app route (`/academy`) streams the exact same catalogue & CDN videos as
// the public static site (`https://speaklab.me/academy/`), keeping the APK
// free of media assets while removing the external browser bar on mobile.
// Public share links and WhatsApp/Instagram admin templates always use
// `https://speaklab.me/academy/?c=...&ch=...&lang=az|tr` so non-app visitors
// can watch directly without signing in.
export const ACADEMY_URL = 'https://speaklab.me/academy/';

export const ACADEMY_CHAPTERS = {
  install:    { course: 'T02', chapter: 'ch1', shortLabel: 'T02 · 1' },
  schedule:   { course: 'T02', chapter: 'ch2', shortLabel: 'T02 · 2' },
  call:       { course: 'T02', chapter: 'ch3', shortLabel: 'T02 · 3' },
  analysis:   { course: 'T02', chapter: 'ch4', shortLabel: 'T02 · 4' },
  activities: { course: 'T03', chapter: 'ch1', shortLabel: 'T03 · 1' },
};

export function normalizeAcademyLang(lang) {
  return lang === 'tr' ? 'tr' : 'az';
}

export function academyShareUrl(seriesId = null, chapterId = null, lang = getFeedbackLanguage()) {
  const q = new URLSearchParams();
  if (seriesId) q.set('c', seriesId);
  if (seriesId && chapterId) q.set('ch', chapterId);
  q.set('lang', normalizeAcademyLang(lang));
  return `${ACADEMY_URL}?${q.toString()}`;
}

export function academyChapterUrl(course, chapter, lang = getFeedbackLanguage()) {
  return academyShareUrl(course, chapter, lang);
}

export function academyUrl(lang = getFeedbackLanguage()) {
  return academyShareUrl(null, null, lang);
}

// Opens SpeakLab Academy inside the app when `navigate` is supplied (preferred),
// falling back to the public web URL if called without router navigation.
// Passing `uid` marks Academy as opened so the newcomer popup stops appearing.
export function openAcademy(navigateOrUid = null, maybeUid = null, opts = {}) {
  const hasNav = typeof navigateOrUid === 'function';
  const uid = hasNav ? maybeUid : navigateOrUid;
  if (uid && typeof uid === 'string') markAcademyOpened(uid);
  if (hasNav) {
    const path = opts.series && opts.chapter
      ? `/academy/${encodeURIComponent(opts.series)}/${encodeURIComponent(opts.chapter)}`
      : opts.series
        ? `/academy/${encodeURIComponent(opts.series)}`
        : '/academy';
    navigateOrUid(path);
    return;
  }
  window.open(academyUrl(), '_blank', 'noopener,noreferrer');
}

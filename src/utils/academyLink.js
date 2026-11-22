import { getFeedbackLanguage } from './feedbackLanguage';

// SpeakLab Academy — the video guides to the app — lives on speaklab.me, NOT
// in the app (Polad 2026-11-22: «yük appa düşməsin», the APK stays well under
// 100 MB). The app only links there, in the learner's language (the videos
// exist in az and tr; getFeedbackLanguage() returns one of the two).
// Site source: the poladagayev90-netizen.github.io repo, folder academy/.
export const ACADEMY_URL = 'https://speaklab.me/academy/';

export function academyUrl(lang = getFeedbackLanguage()) {
  return `${ACADEMY_URL}?lang=${lang === 'tr' ? 'tr' : 'az'}`;
}

// A new tab on the web; on Android the WebView hands `_blank` to the system
// browser — the same way LessonRow and the WhatsApp links leave the app.
export function openAcademy() {
  window.open(academyUrl(), '_blank', 'noopener,noreferrer');
}

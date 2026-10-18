// The one version number of SpeakLab, the same on the web/PWA and in the
// Android app (Polad, 2026-10-17: «PWA and Android must be standardised»).
// android/app/build.gradle reads its versionName from THIS line, so bump it
// here together with versionCode when a new AAB is built — the web gets the
// same number on its next deploy. Profile shows it, so a learner and the team
// can tell which build a phone is running.
export const APP_VERSION = '1.25';

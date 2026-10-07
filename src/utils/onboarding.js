import { isAdminUser } from '../constants';

// Shared vocabulary of the onboarding wizard. Lives outside the page so the
// admin "Applicants" view and the App.js gate can read it without pulling the
// wizard's lazy chunk.

// Bump when the wizard asks something new that every learner must answer.
// App.js sends anyone below this version back through /onboarding once — that
// is how the learners who signed up on the old one-page survey get asked for
// their availability too.
// 2 = the practice charter (scheduled practice): everyone who answered
// version 1 is brought back once, straight to the charter, answers kept.
// 3 = the WhatsApp number (2026-10-07, Polad: the team could not reach
// people): version-2 learners are brought back once, straight to that step.
export const ONBOARDING_VERSION = 3;

// Teachers never answer the learner wizard; the admin can open /onboarding to
// look at it but is not forced through it on every home visit.
export function needsOnboarding(user) {
  if (!user || user.role === 'teacher' || isAdminUser(user)) return false;
  return (Number(user.onboardingVersion) || 0) < ONBOARDING_VERSION;
}

export const GOALS = [
  { value: 'Speaking', label: 'Speak with confidence', hint: 'Everyday conversation without freezing' },
  { value: 'Business', label: 'English for work', hint: 'Meetings, calls, interviews' },
  { value: 'Exam', label: 'Pass an exam', hint: 'IELTS, TOEFL, school exams' },
  { value: 'Travel', label: 'Travel and living abroad', hint: 'Getting around, meeting people' },
  { value: 'Fun', label: 'For myself', hint: 'I enjoy the language' },
];

export const LEVELS = [
  { value: 'A1 – Beginner', short: 'A1', hint: 'I know some words and phrases' },
  { value: 'A2 – Elementary', short: 'A2', hint: 'I can talk about simple, familiar things' },
  { value: 'B1 – Intermediate', short: 'B1', hint: 'I can keep a conversation going, with pauses' },
  { value: 'B2 – Upper-Intermediate', short: 'B2', hint: 'I speak fairly freely on most topics' },
  { value: 'C1 – Advanced', short: 'C1', hint: 'I speak fluently, I want polish' },
  { value: 'C2 – Proficient', short: 'C2', hint: 'Near-native' },
];

// An age BAND, not a birth date: enough to keep minors and adults apart when
// partners are chosen, without storing a date of birth nobody needs.
export const AGE_BANDS = [
  { value: 'under18', label: 'Under 18' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35+', label: '35 or older' },
];

// Where learners actually come from today, each with the zone it almost always
// means. Picking a country only SUGGESTS the zone — the learner confirms it.
export const COUNTRIES = [
  { value: 'Azerbaijan', tz: 'Asia/Baku' },
  { value: 'Türkiye', tz: 'Europe/Istanbul' },
  { value: 'Georgia', tz: 'Asia/Tbilisi' },
  { value: 'Russia', tz: 'Europe/Moscow' },
  { value: 'Kazakhstan', tz: 'Asia/Almaty' },
  { value: 'Uzbekistan', tz: 'Asia/Tashkent' },
  { value: 'Germany', tz: 'Europe/Berlin' },
  { value: 'United Kingdom', tz: 'Europe/London' },
  { value: 'United States', tz: null },
  { value: 'Other', tz: null },
];

export const TOPICS = [
  'Technology', 'Movies', 'Music', 'Travel', 'Business', 'Sport', 'Food',
  'Books', 'Science', 'Psychology', 'Career', 'General',
];

// Practices per week. 4 means "4 or more".
export const WEEKLY_TARGETS = [
  { value: 1, label: '1', hint: 'Once a week' },
  { value: 2, label: '2', hint: 'Twice a week' },
  { value: 3, label: '3', hint: 'Three times' },
  { value: 4, label: '4+', hint: 'Four or more' },
];

export const labelOf = (list, value) => list.find((x) => x.value === value)?.label || value || '—';

// ── WhatsApp number (version 3) ──────────────────────────────────────
// Stored on onboarding/{uid}.whatsapp (owner + admin only, never on the
// world-readable users doc) as E.164: "+994501234567". Only the SpeakLab team
// uses it; partners talk in the app chat.
export const PHONE_CODES = [
  { code: '994', label: 'AZ +994', country: 'Azerbaijan' },
  { code: '90', label: 'TR +90', country: 'Türkiye' },
  { code: '995', label: 'GE +995', country: 'Georgia' },
  { code: '7', label: 'RU/KZ +7', country: 'Russia' },
  { code: '998', label: 'UZ +998', country: 'Uzbekistan' },
  { code: '49', label: 'DE +49', country: 'Germany' },
  { code: '44', label: 'UK +44', country: 'United Kingdom' },
  { code: '1', label: 'US +1', country: 'United States' },
];

export const dialCodeFor = (country) => (country === 'Kazakhstan' ? '7'
  : (PHONE_CODES.find((c) => c.country === country) || {}).code) || '994';

const E164 = /^\+[1-9]\d{7,14}$/;
export const isWhatsApp = (v) => E164.test(String(v || ''));

// What a learner types → E.164, or '' when it cannot be a number.
// "050 123 45 67" with +994 → "+994501234567"; a number typed with its own
// "+90…" or "0090…" keeps that code; "994501234567" (code, no plus) is
// recognised; Russia's trunk "8 916…" becomes +7 916….
export function normalizeWhatsApp(raw, code = '994') {
  const s = String(raw || '').trim();
  if (!s) return '';
  const cc = String(code || '').replace(/\D/g, '');
  let digits = s.replace(/\D/g, '');
  if (s.startsWith('+') || digits.startsWith('00')) {
    const full = `+${digits.replace(/^00/, '')}`;
    return E164.test(full) ? full : '';
  }
  if (cc && digits.startsWith(cc) && digits.length - cc.length >= 9) return E164.test(`+${digits}`) ? `+${digits}` : '';
  if (cc === '7' && digits.length === 11 && digits.startsWith('8')) digits = digits.slice(1);
  digits = digits.replace(/^0+/, '');
  const full = `+${cc}${digits}`;
  return cc && E164.test(full) ? full : '';
}

// The team's link to a learner's WhatsApp, with a greeting typed in.
export function whatsAppLink(number, name = '') {
  const d = String(number || '').replace(/\D/g, '');
  if (!d) return null;
  const first = String(name || '').trim().split(/\s+/)[0];
  const text = `Salam${first ? ` ${first}` : ''}, SpeakLab-dan yazıram.`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

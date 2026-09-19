import { ADMIN_UID } from '../constants';

// Shared vocabulary of the onboarding wizard. Lives outside the page so the
// admin "Applicants" view and the App.js gate can read it without pulling the
// wizard's lazy chunk.

// Bump when the wizard asks something new that every learner must answer.
// App.js sends anyone below this version back through /onboarding once — that
// is how the learners who signed up on the old one-page survey get asked for
// their availability too.
export const ONBOARDING_VERSION = 1;

// Teachers never answer the learner wizard; the admin can open /onboarding to
// look at it but is not forced through it on every home visit.
export function needsOnboarding(user) {
  if (!user || user.role === 'teacher' || user.uid === ADMIN_UID) return false;
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

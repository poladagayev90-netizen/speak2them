import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

// Müəllim funnel-i: müəllim qeydiyyatda "müəllim" seçmir. Normal istifadəçi
// kimi danışır, öz AI analizini alır və yalnız TEACHER_SESSIONS_REQUIRED
// sessiyadan sonra şagird izləmə açılır. Sayğac serverdə (consumeTrialMinutes)
// zəngin öz vaxt damğalarından yazılır — client saatına güvənilmir.
export const TEACHER_SESSIONS_REQUIRED = 3;
export const MIN_LINK_AGE = 13;
export const ADULT_AGE = 18;

// Server xəta kodu → istifadəçi mətni. Serverin hər fərqli kodu üçün fərqli
// mesaj: "tapılmadı" ≠ "dolub" ≠ "artıq bağlısınız".
export const CREATE_CODE_ERROR_TEXT = {
  'not-eligible': `Complete ${TEACHER_SESSIONS_REQUIRED} sessions first to create a code.`,
  'invalid-code': 'A code can only be 4–12 letters or digits (for example: AYTAC01).',
  'code-taken': 'That code is taken. Try a different one.',
  'user-not-found': 'We could not load your profile. Refresh the page and try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

export const CLAIM_CODE_ERROR_TEXT = {
  'consent-required': 'Tick the consent box to continue.',
  'age-restricted': `This service is for users aged ${MIN_LINK_AGE} and over.`,
  'guardian-consent-required': 'If you are under 18, a parent or guardian must give consent.',
  'code-not-found': 'That code was not found. Check the spelling, or ask your teacher for it again.',
  'code-inactive': 'That code is no longer active. Please contact your teacher.',
  'code-expired': 'That code has expired. Ask your teacher for a new one.',
  'code-exhausted': 'That code is full. Your teacher has reached their student limit.',
  'already-linked': 'You are already connected to a teacher.',
  'self-link': 'You cannot use your own code.',
  'teacher-full': 'Your teacher has reached their student limit. Please contact them.',
  'invalid-code': 'That code format is not valid. Check it and try again.',
  'user-not-found': 'We could not load your profile. Refresh the page and try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

const RATE_LIMITED_TEXT = 'Too many attempts. Please try again in an hour.';
const NETWORK_TEXT = 'Network error. Check your connection and try again.';

async function callTeacherFn(path, body, errorMap) {
  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error,
        // 429 serverdə xüsusi kod deyil, status olaraq gəlir.
        errorText: res.status === 429
          ? RATE_LIMITED_TEXT
          : (errorMap[data.error] || 'Something went wrong. Please try again.'),
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(`[${path}]`, e);
    return { ok: false, errorText: NETWORK_TEXT };
  }
}

export function createInviteCode(code) {
  return callTeacherFn('createInviteCode', { code }, CREATE_CODE_ERROR_TEXT);
}

// ── Birbaşa dəvət ───────────────────────────────────────────────
export const INVITE_ERROR_TEXT = {
  'invalid-email': 'That email address is not valid.',
  'not-a-teacher': 'This action is for teachers only.',
  'student-not-found': 'No user is registered with that email. They need to sign up for the app first.',
  'self-invite': 'You cannot invite yourself.',
  'already-your-student': 'That student is already on your list.',
  'already-linked': 'That user is already connected to another teacher.',
  'teacher-full': 'You have reached your student limit.',
  'invite-not-found': 'Invitation not found.',
  'not-your-invite': 'That invitation is not yours.',
  'already-answered': 'That invitation has already been answered.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

export function inviteStudentByEmail(email) {
  return callTeacherFn('inviteStudentByEmail', { email }, INVITE_ERROR_TEXT);
}

// Panel siyahısından birbaşa dəvət. E-poçt yazmaqdan etibarlıdır: bir hərf
// səhvi "istifadəçi tapılmadı" verirdi və müəllim səbəbini bilmirdi.
export function inviteStudentByUid(studentUid) {
  return callTeacherFn('inviteStudentByEmail', { studentUid }, INVITE_ERROR_TEXT);
}

// ── "Bugünkü məşqi bitir" xatırlatması ──────────────────────────
// Müəllim panelindən şagirdə bir push. Serverdə üç qoruma var (yalnız öz
// şagirdin, bu gün məşq edibsə göndərilmir, günə bir dəfə), ona görə burada
// yalnız nəticəni oxumaq qalır — reason sahəsi düymənin nə deyəcəyini seçir.
const NUDGE_ERROR_TEXT = {
  'not-your-student': 'This student is not linked to you any more.',
  'not-found': 'That student account no longer exists.',
  'invalid-student': 'Something went wrong. Please try again.',
  'rate-limited': 'You have sent a lot of reminders today. Try again tomorrow.',
};

export const NUDGE_RESULT_TEXT = {
  sent: 'Reminder sent',
  'already-practised': 'Already practised today',
  'already-nudged': 'Already reminded today',
  'no-devices': 'Notifications are off on their phone',
};

export function nudgeStudent(studentUid) {
  return callTeacherFn('nudgeStudent', { studentUid }, NUDGE_ERROR_TEXT);
}

export function respondTeacherInvite(inviteId, accept) {
  return callTeacherFn('respondTeacherInvite', { inviteId, accept }, INVITE_ERROR_TEXT);
}

// ── Müəllim əl ilə zəng təyin edir ──────────────────────────────
// The board pairs whoever lands in the same block; a teacher needs to choose
// the pair. Every rejection below is a real server check — a teacher who books
// a student who already owes a call at another hour has to see WHICH student,
// otherwise the only feedback is a dead button.
export const SET_MATCH_ERROR_TEXT = {
  'not-a-teacher': 'This action is for teachers only.',
  'not-your-student': 'Both students have to be on your list.',
  'student-not-found': 'That student account no longer exists.',
  'invalid-student': 'Pick two students first.',
  'same-student': 'Pick two different students.',
  'invalid-slot': 'Pick a time first.',
  'slot-past': 'That time has already passed.',
  'slot-too-far': 'You cannot book that far ahead.',
  'student-a-busy': 'The first student already has a call at another time. They need to cancel it first.',
  'student-b-busy': 'The second student already has a call at another time. They need to cancel it first.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

export function teacherSetMatch(studentA, studentB, slotId) {
  return callTeacherFn('teacherSetMatch', { studentA, studentB, slotId }, SET_MATCH_ERROR_TEXT);
}

// ── Tutor profili və təsdiqi ────────────────────────────────────
// Siyahı SERVERDƏKİ TUTOR_SPECIALTIES ilə eyni olmalıdır — server siyahıdan
// kənar dəyərləri sükutla atır, yəni burada əlavə edilən yeni ixtisas serverdə
// də əlavə edilməsə heç vaxt yadda saxlanmaz.
export const TUTOR_SPECIALTIES = [
  'IELTS', 'TOEFL', 'Speaking', 'Business English',
  'Grammar', 'Kids', 'Beginner', 'Exam Prep',
];

export const TUTOR_PROFILE_ERROR_TEXT = {
  'name-required': 'Enter your name — this is what others will see.',
  'not-a-teacher': 'This section is for teachers only.',
  'user-not-found': 'We could not load your profile. Refresh the page and try again.',
  forbidden: 'You do not have permission for this action.',
  'invalid-teacher': 'Teacher not found.',
  unauthorized: 'Your session has expired. Please sign in again.',
};

export function updateTeacherProfile({ displayName, bio, specialties, yearsExperience }) {
  return callTeacherFn(
    'updateTeacherProfile',
    { displayName, bio, specialties, yearsExperience },
    TUTOR_PROFILE_ERROR_TEXT,
  );
}

// Yalnız admin panelindən çağırılır; server ADMIN_UID yoxlaması edir.
export function setTutorVerification(teacherId, verified) {
  return callTeacherFn('setTutorVerification', { teacherId, verified }, TUTOR_PROFILE_ERROR_TEXT);
}

export function claimTeacherCode({ code, birthDate, consent, guardianConsent }) {
  return callTeacherFn(
    'claimTeacherCode',
    { code, birthDate, consent, guardianConsent },
    CLAIM_CODE_ERROR_TEXT,
  );
}

// Doğum tarixindən yaş. Server bunu yenidən və avtoritetlə hesablayır — bu
// yalnız valideyn razılığı qutusunu vaxtında göstərmək üçündür.
export function ageFromBirthDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const born = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  if (born.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age--;
  if (age > 120) return null;
  return age;
}

// Dəvət linki. Native-də HashRouter işlədiyi üçün paylaşılan link HƏMİŞƏ web
// origin-i göstərməlidir — telefonda açılanda brauzer/PWA onu tutur.
export function buildJoinLink(code) {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://speak2them.vercel.app';
  return `${origin}/join?c=${encodeURIComponent(code)}`;
}

// Hesabı olmayan biri dəvət linkini açanda əvvəlcə qeydiyyatdan keçir və kod
// URL-dən itərdi. Kodu saxlayırıq ki, qeydiyyatdan sonra axın davam etsin.
const PENDING_KEY = 'speaklab_pending_join_code';

export function setPendingJoinCode(code) {
  try { localStorage.setItem(PENDING_KEY, code); } catch { /* private mode */ }
}
export function getPendingJoinCode() {
  try { return localStorage.getItem(PENDING_KEY) || ''; } catch { return ''; }
}
export function clearPendingJoinCode() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
}

// Dəvət kodunu URL-dən çıxarır. Üç formanı da qəbul edir:
//   /join?c=CODE            — normal web linki
//   #/join?c=CODE           — Capacitor HashRouter
//   ?start=c_CODE           — Telegram deep link konvensiyası
export function readCodeFromLocation(search, hash) {
  const fromSearch = new URLSearchParams(search || '');
  const direct = fromSearch.get('c');
  if (direct) return direct.toUpperCase();

  const start = fromSearch.get('start');
  if (start && start.startsWith('c_')) return start.slice(2).toUpperCase();

  const h = hash || '';
  const qIndex = h.indexOf('?');
  if (qIndex !== -1) {
    const hashParams = new URLSearchParams(h.slice(qIndex + 1));
    const hc = hashParams.get('c');
    if (hc) return hc.toUpperCase();
    const hs = hashParams.get('start');
    if (hs && hs.startsWith('c_')) return hs.slice(2).toUpperCase();
  }
  return '';
}

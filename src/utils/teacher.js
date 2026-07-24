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
  'not-eligible': `Kod yaratmaq üçün əvvəlcə ${TEACHER_SESSIONS_REQUIRED} sessiya tamamlamalısınız.`,
  'invalid-code': 'Kod yalnız 4–12 hərf/rəqəmdən ibarət ola bilər (məsələn: AYTAC01).',
  'code-taken': 'Bu kod artıq götürülüb. Başqa bir kod sınayın.',
  'user-not-found': 'Profiliniz tapılmadı. Səhifəni yeniləyib yenidən cəhd edin.',
  unauthorized: 'Sessiyanız bitib. Yenidən daxil olun.',
};

export const CLAIM_CODE_ERROR_TEXT = {
  'consent-required': 'Davam etmək üçün razılıq qutusunu işarələyin.',
  'age-restricted': `Bu xidmət ${MIN_LINK_AGE} yaşdan yuxarı istifadəçilər üçündür.`,
  'guardian-consent-required': '18 yaşdan kiçiksinizsə, valideyn/qəyyum razılığı tələb olunur.',
  'code-not-found': 'Bu kod tapılmadı. Hərf səhvi ola bilər — müəlliminizdən kodu bir də soruşun.',
  'code-inactive': 'Bu kod artıq aktiv deyil. Müəllimizlə əlaqə saxlayın.',
  'code-expired': 'Bu kodun vaxtı bitib. Müəllimizdən yeni kod istəyin.',
  'code-exhausted': 'Bu kod dolub — müəllimin şagird limiti tükənib.',
  'already-linked': 'Siz artıq bir müəllimə bağlısınız.',
  'self-link': 'Öz kodunuzu istifadə edə bilməzsiniz.',
  'teacher-full': 'Müəllimin şagird limiti dolub. Onunla əlaqə saxlayın.',
  'invalid-code': 'Kod formatı yanlışdır — hərfləri yoxlayıb yenidən yazın.',
  'user-not-found': 'Profiliniz tapılmadı. Səhifəni yeniləyib yenidən cəhd edin.',
  unauthorized: 'Sessiyanız bitib. Yenidən daxil olun.',
};

const RATE_LIMITED_TEXT = 'Çox cəhd etdiniz. Bir saat sonra yenidən yoxlayın.';
const NETWORK_TEXT = 'Şəbəkə xətası. İnternetinizi yoxlayıb yenidən cəhd edin.';

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
          : (errorMap[data.error] || 'Xəta baş verdi. Yenidən cəhd edin.'),
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

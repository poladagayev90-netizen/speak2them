import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Session times are editable from Firestore without a code change. A config
// with no `sessions` array falls back to the single evening session.
//
// TƏK SAAT: 21:00. Günorta (16:00) sessiyası ləğv edildi — praktika yalnız
// axşam olur, ona görə nə 16:00 xatırlatması gedir, nə də 16:00 pəncərəsi
// cütləşdirir (matchSessionQueue bu siyahı üzərində dövr edir).
//
// sessionDays / bonusDays (weekday numbers, 0=Sunday … 6=Saturday) decide which
// days the global topic cycle advances on — see advanceCycle in functions. They
// live on the same appConfig/session doc and are admin-editable.
//
// DİQQƏT: Bazar = 0, 7 DEYİL. Konfiqə 7 yazılsa bakuWeekday (0–6) heç vaxt
// uyğun gəlməyəcək və bazar səssizcə itəcək.
export const DEFAULT_SESSION_DAYS = [1, 3, 5]; // Mon / Wed / Fri
export const DEFAULT_BONUS_DAYS = [0];         // Sun — 7th day of the week (bonus)

export const DEFAULT_SESSION_CONFIG = {
  enabled: false,
  bufferMinutes: 10,
  sessions: [
    { hour: 21, minute: 0 },
  ],
  sessionDays: DEFAULT_SESSION_DAYS,
  bonusDays: DEFAULT_BONUS_DAYS,
};

export function subscribeToSessionConfig(cb) {
  return onSnapshot(
    doc(db, 'appConfig', 'session'),
    (snap) => cb(snap.exists() ? { ...DEFAULT_SESSION_CONFIG, ...snap.data() } : DEFAULT_SESSION_CONFIG),
    () => cb(DEFAULT_SESSION_CONFIG)
  );
}

// Normalises a config into a sorted list of {hour, minute}. A non-empty
// `sessions` array wins; otherwise the standard evening session is used. Legacy
// single-time configs (bare hour/minute, no sessions) are intentionally
// upgraded to the default rather than preserved.
export function getSessionTimes(config) {
  const list = Array.isArray(config?.sessions) && config.sessions.length
    ? config.sessions
    : DEFAULT_SESSION_CONFIG.sessions;
  return [...list]
    .filter((s) => Number.isFinite(s?.hour))
    .map((s) => ({ hour: s.hour, minute: s.minute || 0 }))
    .sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
}

const pad = (n) => String(n).padStart(2, '0');

// The learner keeps seeing a just-finished session (its "matching…" state) for
// this long before the card rolls forward to the next one.
const ROLL_GRACE_MS = 5 * 60 * 1000;

// Bakı təqvim tarixi "YYYY-MM-DD" (UTC+4, DST yoxdur) — kurs proqresi və
// sessiya günü hesablamaları da bunu paylaşır.
export function bakuDateStr(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(new Date(ms));
}

const bufferMsOf = (config) =>
  (Number.isFinite(config?.bufferMinutes) ? config.bufferMinutes : 10) * 60 * 1000;

function buildWindow(dateStr, time, bufferMs) {
  const startMs = Date.parse(`${dateStr}T${pad(time.hour)}:${pad(time.minute)}:00+04:00`);
  return {
    dateStr,
    sessionId: `${dateStr}-${pad(time.hour)}`,
    hour: time.hour,
    minute: time.minute,
    startMs,
    endMs: startMs + bufferMs,
  };
}

// Baku tarixinin həftə günü (0=Bazar). Tarix sətri UTC gecəyarısı kimi
// oxunur ki, cihazın saat qurşağından asılı olmadan deterministik olsun
// (functions/index.js-dəki bakuWeekday ilə eyni konvensiya).
export function bakuWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Sessiya keçirilən günlər = sessionDays + bonusDays. Redeem xoş-gəldin
// ekranı ("ilk sessiya: …") və Home-dakı sessiya günü banneri bunu oxuyur.
export function getActiveDays(config) {
  const s = Array.isArray(config?.sessionDays) ? config.sessionDays : DEFAULT_SESSION_DAYS;
  const b = Array.isArray(config?.bonusDays) ? config.bonusDays : DEFAULT_BONUS_DAYS;
  return new Set([...s, ...b].map(Number));
}

// Növbəti sessiya GÜNÜ (bugün daxil, hələ keçməmiş sessiya varsa) və o günün
// ilk uyğun sessiya vaxtı. getSessionWindow-dan fərqi: o hər günü sessiya günü
// sayır, bu isə yalnız sessionDays/bonusDays günlərini nəzərə alır.
export function getNextSessionDay(config, nowMs = Date.now()) {
  const days = getActiveDays(config);
  if (days.size === 0) return null;
  const times = getSessionTimes(config);
  for (let i = 0; i < 8; i++) {
    const dayMs = nowMs + i * 24 * 60 * 60 * 1000;
    const dateStr = bakuDateStr(dayMs);
    if (!days.has(bakuWeekday(dateStr))) continue;
    const usable = i > 0
      ? times
      : times.filter((t) =>
          nowMs < Date.parse(`${dateStr}T${pad(t.hour)}:${pad(t.minute)}:00+04:00`));
    if (usable.length) return { dateStr, time: usable[0] };
  }
  return null;
}

// Session times are defined in Baku time (UTC+4, no DST) so every client
// computes the exact same window and sessionId regardless of device timezone.
// Returns the next relevant session: the earliest of today's sessions that has
// not yet finished (including a short grace window), else tomorrow's first.
export function getSessionWindow(config, nowMs = Date.now()) {
  const bufferMs = bufferMsOf(config);
  const times = getSessionTimes(config);
  const today = bakuDateStr(nowMs);

  for (const time of times) {
    const win = buildWindow(today, time, bufferMs);
    if (nowMs < win.endMs + ROLL_GRACE_MS) return win;
  }

  const tomorrow = bakuDateStr(nowMs + 24 * 60 * 60 * 1000);
  return buildWindow(tomorrow, times[0], bufferMs);
}

// Home-dakı canlı geri sayımın oxuduğu pəncərə. getSessionWindow-dan İKİ fərqi:
//
//  1. ROLL_GRACE_MS yoxdur. getSessionWindow bitmiş pəncərəni bir müddət
//     "matching…" vəziyyəti üçün saxlayır; geri sayım isə həmişə QABAĞA
//     baxmalıdır (köhnəlməmək onun bütün mənasıdır), ona görə endMs keçən kimi
//     sabaha sürüşür.
//  2. Sessiya günü FİLTRİ yoxdur — 21:00 tövsiyə saatı HƏR GÜN göstərilir.
//     sessionDays/bonusDays yalnız "əsas gün"ü işarələyir (isMainSessionDay),
//     praktikanı məhdudlaşdırmır: istifadəçi istənilən gün, istənilən saat
//     partnyor axtara bilər.
export function getUpcomingSessionWindow(config, nowMs = Date.now()) {
  const bufferMs = bufferMsOf(config);
  const times = getSessionTimes(config);
  if (times.length === 0) return null;

  const today = bakuDateStr(nowMs);
  for (const time of times) {
    const win = buildWindow(today, time, bufferMs);
    if (nowMs < win.endMs) return win;
  }
  const tomorrow = bakuDateStr(nowMs + 24 * 60 * 60 * 1000);
  return buildWindow(tomorrow, times[0], bufferMs);
}

// Bu Bakı tarixi əsas sessiya günüdürmü (B.e/Çər/Cümə + bonus Bazar)? Əsas
// günlərdə camaat toplaşır; digər günlərdə 21:00 yenə tövsiyə olunur, sadəcə
// daha az adam olur. Heç bir halda qadağa deyil.
export function isMainSessionDay(config, dateStr) {
  return getActiveDays(config).has(bakuWeekday(dateStr));
}

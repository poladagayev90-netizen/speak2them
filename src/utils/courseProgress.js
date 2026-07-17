import { weeklyContent } from '../data/weeklyContent';
import { getActiveDays, bakuDateStr, bakuWeekday } from './sessionSchedule';

// Kurs proqresi per-user Firestore-a YAZILMIR — hər şey cycleTick - startTick
// fərqindən hesablanır (K2 backend konvensiyası). Bu modul həmin hesabları
// bir yerə yığır: Home proqres kartı, trial sayğacı, tamamlanma aşkarı.
export const COURSE_TOPIC_COUNT = weeklyContent.length; // 28
export const TRIAL_DAYS = 2; // functions/index.js TRIAL_DAYS ilə eyni

function toMillis(v) {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  return null;
}

// Kurs userinin tamamladığı mövzu sayı [0..28]; kurs userində deyilsə və ya
// cycle hələ oxunmayıbsa null.
export function getTopicsCompleted(user, cycle) {
  if (!user || user.mode !== 'course' || !Number.isFinite(user.startTick)) return null;
  const tick = cycle && Number.isFinite(cycle.cycleTick) ? Number(cycle.cycleTick) : null;
  if (tick === null) return null;
  return Math.max(0, Math.min(COURSE_TOPIC_COUNT, tick - user.startTick));
}

// Qalan mövzular sessionDays/bonusDays ritmi ilə "yeyilir" — finish tarixi
// bugündən sonrakı {qalan} sayda aktiv günün sonuncusudur. Cycle hər aktiv
// günün səhəri irəlilədiyi üçün bugünkü irəliləmə artıq sayılmış olur.
export function getFinishDateStr(topicsCompleted, sessionConfig, nowMs = Date.now()) {
  if (!Number.isFinite(topicsCompleted)) return null;
  const remaining = COURSE_TOPIC_COUNT - topicsCompleted;
  if (remaining <= 0) return bakuDateStr(nowMs);
  const days = getActiveDays(sessionConfig);
  if (days.size === 0) return null;
  let count = 0;
  for (let i = 1; i <= remaining * 8; i++) {
    const dateStr = bakuDateStr(nowMs + i * 24 * 60 * 60 * 1000);
    if (days.has(bakuWeekday(dateStr))) {
      count += 1;
      if (count === remaining) return dateStr;
    }
  }
  return null;
}

// Trial-ın bitməsinə qalan TAM günlər (bugün daxil yuvarlaqlaşdırılıb):
// 0 = bitib. null = bu user trial ilə məhdudlaşmır (premium / kurs / pulsuz
// giriş dövrü / köhnə trialStartedAt-sız user) — server isTrialExpired ilə
// eyni qaydalar, ekran heç vaxt serverin buraxdığı useri bloklamasın deyə.
export function getTrialDaysLeft(user, nowMs = Date.now()) {
  if (!user) return null;
  // Kohorta müraciət edib admin təsdiqini/başlanğıcını gözləyən user trial
  // müddəti bitsə də bloklanmasın — gözləmə onun günahı deyil.
  if (user.cohortStatus === 'pending' || user.cohortStatus === 'accepted') return null;
  if (user.isPremium) return null;
  const freeUntil = toMillis(user.freeAccessUntil);
  if (freeUntil && freeUntil > nowMs) return null;
  if (user.subscriptionPlan && user.subscriptionPlan !== 'trial' && user.subscriptionPlan !== 'free') return null;
  const startedMs = toMillis(user.trialStartedAt);
  if (!startedMs) return null;
  const msLeft = startedMs + TRIAL_DAYS * 24 * 60 * 60 * 1000 - nowMs;
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

// Client-side güzgüsü: server getAgoraToken-da onsuz da bloklayır; bu, həmin
// vəziyyəti ekranda göstərmək üçündür (ADDIM 5 tam-ekran görünüşü).
export function isTrialExpiredClient(user, nowMs = Date.now()) {
  return getTrialDaysLeft(user, nowMs) === 0;
}

// "YYYY-MM-DD" → "çərşənbə, 22 iyul" (az lokalında).
export function formatAzDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('az', {
      weekday: 'long', day: 'numeric', month: 'long',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return dateStr;
  }
}

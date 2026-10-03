import { weeklyContent } from '../data/weeklyContent';
import { getActiveDays, bakuDateStr, bakuWeekday } from './sessionSchedule';
import { ADMIN_UID } from '../constants';

// Kurs proqresi per-user Firestore-a YAZILMIR — hər şey cycleTick - startTick
// fərqindən hesablanır (K2 backend konvensiyası). Bu modul həmin hesabları
// bir yerə yığır: Home proqres kartı, trial sayğacı, tamamlanma aşkarı.
export const COURSE_TOPIC_COUNT = weeklyContent.length; // 60 since the deck doubled

// Kurs userinin tamamladığı mövzu sayı [0..COURSE_TOPIC_COUNT]; kurs userində deyilsə və ya
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

// Admin hesabı = daimi Pro. Tək mənbə: hər iki sahə yoxlanılır, çünki bəzi
// yerlərdə user obyekti Firestore sənədidir (id), bəzilərində App.js-in
// birləşdirdiyi auth+doc obyektidir (uid).
export function isAdminUser(user) {
  if (!user) return false;
  return user.uid === ADMIN_UID || user.id === ADMIN_UID;
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

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Baku calendar helpers + the topic-cycle days.
//
// The fixed evening session (21:00 reminder, countdown, join-the-session queue)
// was removed on 2026-11-06: practice is on-demand, so nothing here may name or
// imply a set hour. What stays on appConfig/session is sessionDays / bonusDays
// (weekday numbers, 0=Sunday … 6=Saturday): they decide which days the global
// topic cycle advances on — see advanceCycle in functions. Admin-editable.
//
// DİQQƏT: Bazar = 0, 7 DEYİL. Konfiqə 7 yazılsa bakuWeekday (0–6) heç vaxt
// uyğun gəlməyəcək və bazar səssizcə itəcək.
export const DEFAULT_SESSION_DAYS = [0, 1, 2, 3, 4, 5, 6]; // All days (Mon-Sun)
export const DEFAULT_BONUS_DAYS = [0];         // Sun

export const DEFAULT_SESSION_CONFIG = {
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

// Bakı təqvim tarixi "YYYY-MM-DD" (UTC+4, DST yoxdur) — kurs proqresi və
// mövzu günü hesablamaları da bunu paylaşır.
export function bakuDateStr(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baku' }).format(new Date(ms));
}

// Baku tarixinin həftə günü (0=Bazar). Tarix sətri UTC gecəyarısı kimi
// oxunur ki, cihazın saat qurşağından asılı olmadan deterministik olsun
// (functions/index.js-dəki bakuWeekday ilə eyni konvensiya).
export function bakuWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Mövzu cycle-ının irəlilədiyi günlər = sessionDays + bonusDays.
export function getActiveDays(config) {
  const s = Array.isArray(config?.sessionDays) ? config.sessionDays : DEFAULT_SESSION_DAYS;
  const b = Array.isArray(config?.bonusDays) ? config.bonusDays : DEFAULT_BONUS_DAYS;
  return new Set([...s, ...b].map(Number));
}

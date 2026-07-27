import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';
import { bakuDateStr } from './sessionSchedule';

// Praktika slotları — koordinasiya modelinin client tərəfi.
//
// Niyə 2 saatlıq bloklar, saatbaşı yox: 20 nəfərlik bazada xana sayı nə qədər
// çoxdursa, iki nəfərin eyni xanaya düşmə ehtimalı bir o qədər aşağıdır.
// 8 blok × 3 gün = 24 xana; saatbaşı olsaydı 45 xana olar və hər kəs ayrı
// xanada tək qalardı — lövhə dolu görünüb heç bir eşləşmə verməzdi.
//
// Blok yalnız MÜSAİTLİK elanıdır. İki nəfər eyni bloka düşəndə randevu blokun
// BAŞLANĞIC saatına bərkidilir ("Bu gün 14:00"), yəni qeyri-müəyyənlik qalmır.
export const SLOT_BLOCK_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
export const SLOT_HORIZON_DAYS = 3;
export const SLOT_BLOCK_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 21:00 bu blokun içindədir. Köhnə "hər axşam 21:00" ritualı ayrıca kod yolu
// kimi deyil, lövhədəki ⭐ blok kimi yaşayır — bir mexanizm, bir kod yolu.
export const POPULAR_HOUR = 20;

export const slotIdOf = (dateStr, hour) => `${dateStr}-${String(hour).padStart(2, '0')}`;

// Bakı saatı (UTC+4, DST yoxdur) — hər cihaz eyni ms dəyərini hesablasın deyə
// ofset sətrin içinə yazılır, cihazın öz saat qurşağına heç vaxt güvənilmir.
export const slotStartMs = (dateStr, hour) =>
  Date.parse(`${dateStr}T${String(hour).padStart(2, '0')}:00:00+04:00`);

export function parseSlotId(slotId) {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(String(slotId || ''));
  if (!m) return null;
  const hour = Number(m[2]);
  if (!SLOT_BLOCK_HOURS.includes(hour)) return null;
  const startMs = slotStartMs(m[1], hour);
  if (!Number.isFinite(startMs)) return null;
  return { slotId, date: m[1], hour, startMs, endMs: startMs + SLOT_BLOCK_MS };
}

// Lövhədə göstərilən günlər.
export function boardDates(nowMs = Date.now()) {
  return Array.from({ length: SLOT_HORIZON_DAYS }, (_, i) => bakuDateStr(nowMs + i * DAY_MS));
}

// İçində HAZIRDA olduğumuz blok. Axtarış partnyor tapmayanda istifadəçi
// avtomatik bura düşür — niyyət beləcə yaddaşa yazılır və 5 dəqiqə sonra
// gələn adam onu görə bilir. Bloklar 08:00–24:00-ı əhatə edir; gecə saatlarında
// (00:00–08:00) null qayıdır, o zaman sadəcə lövhə açılır.
export function currentBlockSlotId(nowMs = Date.now()) {
  const dateStr = bakuDateStr(nowMs);
  for (let i = SLOT_BLOCK_HOURS.length - 1; i >= 0; i--) {
    const hour = SLOT_BLOCK_HOURS[i];
    const start = slotStartMs(dateStr, hour);
    if (nowMs >= start && nowMs < start + SLOT_BLOCK_MS) return slotIdOf(dateStr, hour);
  }
  return null;
}

export function dayLabel(dateStr, nowMs = Date.now()) {
  if (dateStr === bakuDateStr(nowMs)) return 'Bu gün';
  if (dateStr === bakuDateStr(nowMs + DAY_MS)) return 'Sabah';
  const [y, m, d] = dateStr.split('-').map(Number);
  const AZ_DAYS = ['Bazar', 'B.e', 'Ç.a', 'Çərşənbə', 'C.a', 'Cümə', 'Şənbə'];
  return AZ_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export const hourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`;
export const blockLabel = (hour) => `${hourLabel(hour)}–${hourLabel((hour + 2) % 24)}`;

// Lövhə BİR sorğu ilə yüklənir: ≤24 sənəd, tək sahəli avtomatik indeks.
// Sənədlərdə ad yoxdur (yalnız saylar), ona görə anonimlik əlavə iş tələb etmir.
export function subscribeToBoard(dates, cb) {
  return onSnapshot(
    query(collection(db, 'practiceSlots'), where('date', 'in', dates)),
    (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      cb(map);
    },
    () => cb({}),
  );
}

// Öz sənədim — randevu, öz slotlarım və nəzakətli xatırlatma bayrağı burdadır.
// App.js-dəki canlı sinxron siyahısına salına bilmirlər (obyekt/massiv `!==`
// müqayisəsini heç vaxt keçmir), ona görə ayrıca dinləyici.
export function subscribeToMySlots(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    cb({
      slotIds: Array.isArray(d.practiceSlotIds) ? d.practiceSlotIds : [],
      recurringSlots: Array.isArray(d.recurringSlots) ? d.recurringSlots : [],
      upcomingCall: d.upcomingCall || null,
      slotNoticePending: d.slotNoticePending === true,
    });
  }, () => {});
}

const SLOT_ERROR_TEXT = {
  'invalid-slot': 'Bu vaxt artıq keçərli deyil.',
  'slot-past': 'Bu blok artıq bitib.',
  'slot-too-far': 'Bu qədər irəli vaxt seçmək olmur.',
  'user-not-found': 'Profiliniz tapılmadı. Səhifəni yeniləyin.',
  'invalid-schedule': 'Qrafik yadda saxlanılmadı.',
  unauthorized: 'Sessiyanız bitib. Yenidən daxil olun.',
};

async function callSlotFn(path, body) {
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
        errorText: res.status === 429
          ? 'Çox cəhd etdiniz. Bir azdan yenidən yoxlayın.'
          : (SLOT_ERROR_TEXT[data.error] || 'Xəta baş verdi. Yenidən cəhd edin.'),
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(`[${path}]`, e);
    return { ok: false, errorText: 'Şəbəkə xətası. İnternetinizi yoxlayın.' };
  }
}

export const joinPracticeSlot = (slotId) => callSlotFn('joinPracticeSlot', { slotId });
export const leavePracticeSlot = (slotId) => callSlotFn('leavePracticeSlot', { slotId });
export const setRecurringSlots = (recurringSlots) =>
  callSlotFn('setRecurringSlots', { recurringSlots });

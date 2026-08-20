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
  if (dateStr === bakuDateStr(nowMs)) return 'Today';
  if (dateStr === bakuDateStr(nowMs + DAY_MS)) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
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
  'invalid-slot': 'That time has passed.',
  'slot-past': 'That block has ended.',
  'slot-too-far': 'You cannot book that far ahead.',
  'user-not-found': 'We could not load your profile. Refresh the page.',
  'invalid-schedule': 'Your schedule was not saved.',
  'same-slot': 'That time is already in your schedule.',
  'not-in-slot': 'Bu blokda deyilsiniz.',
  'not-matched': 'That call is not confirmed yet.',
  'already-in-target': 'You or your partner are already booked in that block.',
  'request-not-found': 'Request not found.',
  'not-your-request': 'That request is not yours.',
  'already-answered': 'That request has already been answered.',
  'pair-gone': 'The call was cancelled in the meantime, so there is nothing to move.',
  unauthorized: 'Your session has expired. Please sign in again.',
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
          ? 'Too many attempts. Please try again shortly.'
          : (SLOT_ERROR_TEXT[data.error] || 'Something went wrong. Please try again.'),
      };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(`[${path}]`, e);
    return { ok: false, errorText: 'Network error. Check your connection.' };
  }
}

// Gələcək bloklar — vaxt dəyişikliyi seçicisi üçün (keçmiş və cari üfüq daxili).
export function upcomingBlocks(nowMs = Date.now(), excludeSlotId = null) {
  const out = [];
  for (const dateStr of boardDates(nowMs)) {
    for (const hour of SLOT_BLOCK_HOURS) {
      const slotId = slotIdOf(dateStr, hour);
      const startMs = slotStartMs(dateStr, hour);
      if (startMs + SLOT_BLOCK_MS <= nowMs) continue;
      if (slotId === excludeSlotId) continue;
      out.push({ slotId, date: dateStr, hour, startMs });
    }
  }
  return out;
}

export function subscribeToSlotChange(uid, cb) {
  return onSnapshot(
    query(
      collection(db, 'slotChanges'),
      where('peerUid', '==', uid),
      where('status', '==', 'pending'),
    ),
    (snap) => cb(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }),
    () => cb(null),
  );
}

export const proposeSlotChange = (fromSlotId, toSlotId) =>
  callSlotFn('proposeSlotChange', { fromSlotId, toSlotId });
export const respondSlotChange = (requestId, accept) =>
  callSlotFn('respondSlotChange', { requestId, accept });

export const joinPracticeSlot = (slotId) => callSlotFn('joinPracticeSlot', { slotId });
export const leavePracticeSlot = (slotId) => callSlotFn('leavePracticeSlot', { slotId });
export const setRecurringSlots = (recurringSlots) =>
  callSlotFn('setRecurringSlots', { recurringSlots });

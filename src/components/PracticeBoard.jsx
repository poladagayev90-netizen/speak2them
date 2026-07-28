import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Repeat, ChevronDown, ChevronUp } from 'lucide-react';
import {
  SLOT_BLOCK_HOURS,
  POPULAR_HOUR,
  SLOT_BLOCK_MS,
  boardDates,
  slotIdOf,
  slotStartMs,
  dayLabel,
  blockLabel,
  hourLabel,
  subscribeToBoard,
  joinPracticeSlot,
  leavePracticeSlot,
  setRecurringSlots,
} from '../utils/practiceSlots';

// Praktika lövhəsi — koordinasiya problemi matching problemi deyil.
//
// İstifadəçi "müsaitəm" deyir, sistem iki nəfəri AVTOMATİK cütləşdirir.
// Sorğu/qəbul mərhələsi yoxdur, ona görə rədd edilmək də mümkün deyil.
// Lövhədə AD GÖRÜNMÜR, yalnız say: düymə şəxsə yox, bloka basılır.
//
// Həftəlik grid qəsdən işlədilmir — 390px ekranda oxunmur. Gün tabları +
// şaquli blok siyahısı eyni məlumatı telefonda oxunaqlı verir.
const BOARD_OPEN_KEY = 'speaklab_board_open';

export default function PracticeBoard({ mine, openSignal = 0 }) {
  const [board, setBoard] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  // Açıq/bağlı seçimi localStorage-də saxlanılır. Tab dəyişəndə Home tamamilə
  // unmount olur, ona görə yalnız state-də saxlansaydı istifadəçinin bağlaması
  // hər qayıdışda unudulurdu — məhz bildirilən problem.
  // null = istifadəçi hələ seçim etməyib; o halda ilk açılışda aşağıdakı
  // qayda işləyir (vaxtı olmayan üçün açıq, olan üçün bağlı).
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(BOARD_OPEN_KEY);
      return v === null ? null : v === '1';
    } catch { return null; }
  });

  const setOpenPersist = useCallback((next) => {
    setOpen(next);
    try { localStorage.setItem(BOARD_OPEN_KEY, next ? '1' : '0'); } catch { /* private mode */ }
  }, []);

  const dates = useMemo(() => boardDates(now), [now]);

  // "Keçdi/indi" vəziyyəti dəqiqədə bir yenilənsin — açıq qalan səhifədə
  // bitmiş blok qoşula bilən kimi görünməsin.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => subscribeToBoard(boardDates(), setBoard), []);

  // Axtarış partnyor tapmayanda Home siqnal göndərir — lövhə mütləq görünməlidir.
  useEffect(() => { if (openSignal > 0) setOpenPersist(true); }, [openSignal, setOpenPersist]);

  const mySlotIds = mine?.slotIds || [];
  const recurring = mine?.recurringSlots || [];
  const upcoming = mine?.upcomingCall || null;
  const recurringHours = new Set(
    recurring.filter((r) => r.day === 'daily').map((r) => Number(r.hour)),
  );

  // Bu gün neçə blokda kimsə gözləyir — bağlı başlığın hərəkətə çağıran hissəsi.
  const todayWaiting = SLOT_BLOCK_HOURS.reduce((count, hour) => {
    const id = slotIdOf(dates[0], hour);
    const past = slotStartMs(dates[0], hour) + SLOT_BLOCK_MS <= now;
    const w = Number(board[id]?.waitingCount) || 0;
    const mineHere = mySlotIds.includes(id) && upcoming?.slotId !== id;
    return count + (!past && Math.max(0, w - (mineHere ? 1 : 0)) > 0 ? 1 : 0);
  }, 0);

  const expanded = open === null ? (mySlotIds.length === 0 && !upcoming) : open;

  const toggleSlot = async (slotId, joined, matched) => {
    if (matched && !window.confirm(
      'Bu zəngi ləğv edirsiniz? Partnyorunuza bildiriş gedəcək.',
    )) return;
    setBusy(slotId);
    setError('');
    const res = joined ? await leavePracticeSlot(slotId) : await joinPracticeSlot(slotId);
    setBusy('');
    if (!res.ok) setError(res.errorText);
  };

  const toggleRecurring = async (hour) => {
    const on = recurringHours.has(hour);
    const next = on
      ? recurring.filter((r) => !(r.day === 'daily' && Number(r.hour) === hour))
      : [...recurring, { day: 'daily', hour }];
    setBusy(`rec-${hour}`);
    const res = await setRecurringSlots(next);
    setBusy('');
    if (!res.ok) setError(res.errorText);
  };

  const activeDate = dates[dayIndex] || dates[0];

  // "Biri 18:00-a, biri 21:00-a yazılıb" problemi. İkisi də tək qalır, çünki
  // cüt yalnız EYNİ blokda qurulur. Burada tək gözləyən adama başqa blokdakı
  // tək gözləyəni göstəririk: bir toxunuşla ora da yazılır və zəng dərhal
  // təsdiqlənir. Push-a arxalanmır — istifadəçi tətbiqi açanda onsuz da görür.
  const myWaitingSlot = mySlotIds.find((id) => id !== upcoming?.slotId);
  const bridge = (() => {
    if (!myWaitingSlot) return null;
    for (const dateStr of dates) {
      for (const hour of SLOT_BLOCK_HOURS) {
        const id = slotIdOf(dateStr, hour);
        if (id === myWaitingSlot || mySlotIds.includes(id)) continue;
        if (slotStartMs(dateStr, hour) + SLOT_BLOCK_MS <= now) continue;
        if ((Number(board[id]?.waitingCount) || 0) > 0) {
          return { slotId: id, date: dateStr, hour };
        }
      }
    }
    return null;
  })();

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '14px', marginBottom: '14px',
    }}>
      <button
        type="button"
        onClick={() => setOpenPersist(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Nə vaxt müsaitsiniz?
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {todayWaiting > 0
              ? `Bu gün ${todayWaiting} blokda adam gözləyir`
              : 'Vaxtınızı seçin — ikinci nəfər qoşulan kimi təsdiqlənəcək'}
          </div>
        </div>
        {todayWaiting > 0 && !expanded && (
          <span style={{
            fontSize: '12px', fontWeight: 800, padding: '4px 9px', borderRadius: '20px',
            background: '#f59e0b22', color: '#f59e0b', flexShrink: 0,
          }}>
            🔥 {todayWaiting}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      {bridge && (
        <div style={{
          marginTop: '12px', padding: '12px',
          background: '#f59e0b14', border: '1px solid #f59e0b44', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <b>{dayLabel(bridge.date, now)} {blockLabel(bridge.hour)}</b> blokunda bir nəfər
            gözləyir — ora da yazılsanız zəng dərhal təsdiqlənəcək.
          </div>
          <button
            type="button"
            onClick={() => toggleSlot(bridge.slotId, false, false)}
            disabled={busy === bridge.slotId}
            style={{
              flexShrink: 0, padding: '9px 12px', borderRadius: '9px', border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#1a1000',
              fontSize: '12px', fontWeight: 800, cursor: 'pointer',
            }}
          >
            {busy === bridge.slotId ? '...' : 'Ora da yazıl'}
          </button>
        </div>
      )}

      {expanded && (
        <>
          <div style={{ display: 'flex', gap: '6px', margin: '14px 0 10px' }}>
            {dates.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setDayIndex(i)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: '9px', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer',
                  border: i === dayIndex ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: i === dayIndex ? 'var(--accent-soft)' : 'transparent',
                  color: i === dayIndex ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {dayLabel(d, now)}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '8px' }}>⚠️ {error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {SLOT_BLOCK_HOURS.map((hour) => {
              const slotId = slotIdOf(activeDate, hour);
              const startMs = slotStartMs(activeDate, hour);
              const past = startMs + SLOT_BLOCK_MS <= now;
              const isNow = now >= startMs && !past;
              const waiting = Number(board[slotId]?.waitingCount) || 0;
              const joined = mySlotIds.includes(slotId);
              const iAmMatched = upcoming?.slotId === slotId;
              const working = busy === slotId;
              const isRecurring = recurringHours.has(hour);

              // Öz sətrimi saymıram — "1 nəfər gözləyir" görüb özümü
              // gözlədiyimi düşünməyim deyə.
              const othersWaiting = joined && !iAmMatched ? Math.max(0, waiting - 1) : waiting;

              // Boş blokda alt sətir HEÇ NƏ göstərmir. Əvvəl hər sətirdə "—"
              // vardı və səkkiz sətir boyu təkrarlanan tire lövhəni doldurulmuş
              // kimi göstərib əsl siqnalı (kimin gözlədiyini) batırırdı.
              let sub = null;
              if (iAmMatched) {
                sub = { text: `${upcoming.peerName || 'Partnyorunuz'} ilə təsdiqləndi`, color: 'var(--success)' };
              } else if (joined) {
                sub = { text: 'Yazıldınız — partnyor gözlənilir', color: 'var(--accent)' };
              } else if (othersWaiting > 0) {
                sub = { text: `${othersWaiting} nəfər gözləyir`, color: '#f59e0b' };
              }
              // "İsti" blok = kimsə gözləyir və hələ qoşulmamışam. Yalnız bu
              // sətirdə düymə dolu olur; qalan səkkiz sətir sakit qalır, yoxsa
              // eyni parlaqlıqda səkkiz düymə divarı yaranır və heç biri
              // diqqət çəkmir.
              const hot = !joined && othersWaiting > 0 && !past;

              return (
                <div
                  key={slotId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    // Adam gözləyən blok fərqlənir — göz düymələrə yox,
                    // hərəkət lazım olan sətrə düşməlidir.
                    background: hot ? '#f59e0b14' : 'var(--bg-card)',
                    borderRadius: '11px',
                    padding: sub ? '9px 11px' : '11px',
                    border: iAmMatched
                      ? '1px solid var(--success)'
                      : hot ? '1px solid #f59e0b44' : '1px solid transparent',
                    opacity: past ? 0.38 : 1,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {blockLabel(hour)}
                      {hour === POPULAR_HOUR && <span title="Ən çox adam bu saatda">⭐</span>}
                      {isNow && (
                        <span style={{
                          fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '20px',
                          background: 'var(--accent-soft)', color: 'var(--accent)', letterSpacing: '0.5px',
                        }}>İNDİ</span>
                      )}
                    </div>
                    {sub && (
                      <div style={{ fontSize: '12px', color: sub.color, marginTop: '2px' }}>
                        {sub.text}
                      </div>
                    )}
                  </div>

                  {!past && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleRecurring(hour)}
                        disabled={busy === `rec-${hour}`}
                        aria-label="Hər gün təkrarla"
                        title="Hər gün bu saatda təkrarla"
                        style={{
                          width: '30px', height: '30px', borderRadius: '9px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          border: isRecurring ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: isRecurring ? 'var(--accent-soft)' : 'transparent',
                          color: isRecurring ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        <Repeat size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSlot(slotId, joined, iAmMatched)}
                        disabled={working}
                        style={{
                          minWidth: '76px', padding: '8px 10px', borderRadius: '9px',
                          fontSize: '12px', fontWeight: 800, cursor: working ? 'default' : 'pointer',
                          flexShrink: 0,
                          border: hot ? 'none' : '1px solid var(--border)',
                          background: hot
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : 'transparent',
                          color: hot
                            ? '#1a1000'
                            : joined ? 'var(--text-secondary)' : 'var(--accent)',
                        }}
                      >
                        {working ? '...' : joined ? 'Ləğv et' : hot ? 'Qoşul' : 'Müsaitəm'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {recurringHours.size > 0 && (
            <div style={{
              fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5,
              marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Repeat size={13} />
              Hər gün {[...recurringHours].sort((a, b) => a - b).map(hourLabel).join(', ')} —
              avtomatik seçilir.
            </div>
          )}
        </>
      )}
    </div>
  );
}

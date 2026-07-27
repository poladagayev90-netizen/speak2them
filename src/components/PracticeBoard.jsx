import React, { useEffect, useMemo, useState } from 'react';
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
export default function PracticeBoard({ user, mine, onJoined }) {
  const [board, setBoard] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  const dates = useMemo(() => boardDates(now), [now]);

  // Blokun "keçdi/indi" vəziyyəti dəqiqədə bir yenilənsin — açıq qalan
  // səhifədə bitmiş blok qoşulan kimi görünməsin.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => subscribeToBoard(boardDates(), setBoard), []);

  const mySlotIds = mine?.slotIds || [];
  const recurring = mine?.recurringSlots || [];
  const upcoming = mine?.upcomingCall || null;
  const recurringHours = new Set(
    recurring.filter((r) => r.day === 'daily').map((r) => Number(r.hour)),
  );

  const toggleSlot = async (slotId, joined) => {
    setBusy(slotId);
    setError('');
    const res = joined ? await leavePracticeSlot(slotId) : await joinPracticeSlot(slotId);
    setBusy('');
    if (!res.ok) { setError(res.errorText); return; }
    if (!joined && res.data?.matched && onJoined) onJoined(res.data);
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

  const card = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '16px', marginBottom: '16px',
  };

  return (
    <div style={card}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
        🗓️ Nə vaxt müsaitsiniz?
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
        Vaxtınızı seçin və çıxın. Eyni bloka ikinci nəfər qoşulan kimi zənginiz
        avtomatik təsdiqlənəcək və sizə bildiriş gələcək.
      </div>

      {/* Gün tabları */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {dates.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => setDayIndex(i)}
            style={{
              flex: 1, padding: '9px 4px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer',
              border: i === dayIndex ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: i === dayIndex ? 'var(--accent-soft)' : 'var(--bg-card)',
              color: i === dayIndex ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {dayLabel(d, now)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '10px' }}>⚠️ {error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {SLOT_BLOCK_HOURS.map((hour) => {
          const slotId = slotIdOf(activeDate, hour);
          const startMs = slotStartMs(activeDate, hour);
          const past = startMs + SLOT_BLOCK_MS <= now;
          const isNow = now >= startMs && !past;
          const data = board[slotId] || {};
          const waiting = Number(data.waitingCount) || 0;
          const matched = Number(data.matchedCount) || 0;
          const joined = mySlotIds.includes(slotId);
          const iAmMatched = upcoming?.slotId === slotId;
          const working = busy === slotId;

          // Öz sətrim gözlədiyim adamı da sayır — "1 nəfər gözləyir" görüb
          // özümü gözlədiyimi düşünməyim deyə öz payımı çıxıram.
          const othersWaiting = joined && !iAmMatched ? Math.max(0, waiting - 1) : waiting;

          let chip = { text: '—', color: 'var(--text-muted)' };
          if (iAmMatched) {
            chip = { text: `✅ ${upcoming.peerName || 'Partnyorunuz'} ilə`, color: 'var(--success)' };
          } else if (joined) {
            chip = { text: '⏳ Yazıldınız', color: 'var(--accent)' };
          } else if (othersWaiting > 0) {
            chip = { text: `🔥 ${othersWaiting} nəfər gözləyir`, color: '#f59e0b' };
          } else if (matched > 0) {
            chip = { text: `${Math.floor(matched / 2)} zəng planlaşdırılıb`, color: 'var(--text-secondary)' };
          }

          return (
            <div
              key={slotId}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'var(--bg-card)', borderRadius: '12px', padding: '11px 12px',
                border: iAmMatched ? '1px solid var(--success)' : '1px solid transparent',
                opacity: past ? 0.42 : 1,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                }}>
                  {blockLabel(hour)}
                  {hour === POPULAR_HOUR && <span title="Ən çox adam bu saatda toplaşır">⭐</span>}
                  {isNow && (
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '20px',
                      background: 'var(--accent-soft)', color: 'var(--accent)',
                    }}>İNDİ</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: chip.color, marginTop: '3px' }}>{chip.text}</div>
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
                      width: '34px', height: '34px', borderRadius: '10px', cursor: 'pointer',
                      fontSize: '14px', lineHeight: 1,
                      border: recurringHours.has(hour) ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: recurringHours.has(hour) ? 'var(--accent-soft)' : 'transparent',
                      color: recurringHours.has(hour) ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    🔁
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSlot(slotId, joined)}
                    disabled={working || iAmMatched}
                    style={{
                      minWidth: '88px', padding: '9px 12px', borderRadius: '10px',
                      fontSize: '13px', fontWeight: 800,
                      cursor: (working || iAmMatched) ? 'default' : 'pointer',
                      border: joined ? '1px solid var(--border)' : 'none',
                      background: joined
                        ? 'transparent'
                        : 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
                      color: joined ? 'var(--text-secondary)' : '#fff',
                    }}
                  >
                    {working ? '...' : iAmMatched ? 'Təsdiqli' : joined ? 'Çıx' : 'Müsaitəm'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {recurringHours.size > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '12px' }}>
          🔁 Hər gün {[...recurringHours].sort((a, b) => a - b).map(hourLabel).join(', ')} —
          bu saatlar hər gün avtomatik seçilir, yenidən yazılmağa ehtiyac yoxdur.
        </div>
      )}
    </div>
  );
}

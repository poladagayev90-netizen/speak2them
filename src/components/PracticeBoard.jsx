import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Repeat, ChevronDown, ChevronUp, Star } from 'lucide-react';
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

// Calendly-üslub: 8 bloku günün hissələrinə görə qruplaşdırıb çip grid kimi
// göstəririk. Şaquli 8-sətirlik siyahı monotondu; qruplu çip skan etməyi
// asanlaşdırır və peşəkar görünür.
const DAY_PARTS = [
  { label: 'Morning', hours: [8, 10] },
  { label: 'Afternoon', hours: [12, 14, 16] },
  { label: 'Evening', hours: [18, 20, 22] },
];

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
  // Təkrarlanan vaxtlar irəli xüsusiyyətdir — əsas görünüşü qarışdırmasın deyə
  // ayrıca yığcam bölmədə, defolt bağlı.
  const [recurOpen, setRecurOpen] = useState(false);

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

  // Collapsed until asked for. It used to default OPEN for anyone with no slots
  // booked -- which is every new user -- so the first thing a new account saw
  // was a grid of grey "Passed" blocks, i.e. "there is nothing here". The home
  // screen now leads with something you can actually do, and this board sells
  // itself from its own header.
  const expanded = open === null ? false : open;

  const toggleSlot = async (slotId, joined, matched) => {
    if (matched && !window.confirm(
      'Cancel this call? Your partner will be notified.',
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
            When are you free?
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {todayWaiting > 0
              ? `${todayWaiting} ${todayWaiting === 1 ? 'block has' : 'blocks have'} someone waiting today`
              : 'Pick a time — it is confirmed as soon as a second person joins'}
          </div>
        </div>
        {todayWaiting > 0 && !expanded && (
          <span style={{
            fontSize: '12px', fontWeight: 800, padding: '4px 9px', borderRadius: '20px',
            background: 'var(--warning-bg)', color: 'var(--warning)', flexShrink: 0,
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
          background: 'var(--warning)14', border: '1px solid var(--warning)44', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <b>{dayLabel(bridge.date, now)} {blockLabel(bridge.hour)}</b> block has someone waiting — join it and your call is confirmed straight away.
          </div>
          <button
            type="button"
            onClick={() => toggleSlot(bridge.slotId, false, false)}
            disabled={busy === bridge.slotId}
            style={{
              flexShrink: 0, padding: '9px 12px', borderRadius: '9px', border: 'none',
              background: 'linear-gradient(135deg, var(--warning), #d97706)', color: '#1a1000',
              fontSize: '12px', fontWeight: 800, cursor: 'pointer',
            }}
          >
            {busy === bridge.slotId ? '...' : 'Join that one too'}
          </button>
        </div>
      )}

      {expanded && (
        <>
          {/* Gün tabları — nisbi ad + tarix nömrəsi (Calendly kimi konkretlik). */}
          <div style={{ display: 'flex', gap: '6px', margin: '14px 0 12px' }}>
            {dates.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setDayIndex(i)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: '10px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                  border: i === dayIndex ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: i === dayIndex ? 'var(--accent-soft)' : 'transparent',
                  color: i === dayIndex ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 800 }}>{dayLabel(d, now)}</span>
                <span style={{ fontSize: '10px', opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                  {d.slice(5).replace('-', '.')}
                </span>
              </button>
            ))}
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '8px' }}> {error}</div>
          )}

          {/* Vaxt çipləri — günün hissəsinə görə qruplu grid. */}
          {DAY_PARTS.map((part) => (
            <div key={part.label} style={{ marginBottom: '10px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 800, letterSpacing: '0.6px',
                textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 2px 6px',
              }}>
                {part.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '7px' }}>
                {part.hours.map((hour) => {
                  const slotId = slotIdOf(activeDate, hour);
                  const startMs = slotStartMs(activeDate, hour);
                  const past = startMs + SLOT_BLOCK_MS <= now;
                  const isNow = now >= startMs && !past;
                  const waiting = Number(board[slotId]?.waitingCount) || 0;
                  const joined = mySlotIds.includes(slotId);
                  const iAmMatched = upcoming?.slotId === slotId;
                  const working = busy === slotId;
                  const popular = hour === POPULAR_HOUR;
                  // Öz sətrimi saymıram — "1 nəfər gözləyir" görüb özümü
                  // gözlədiyimi düşünməyim deyə.
                  const othersWaiting = joined && !iAmMatched ? Math.max(0, waiting - 1) : waiting;
                  const hot = !joined && othersWaiting > 0 && !past;

                  let border = 'var(--border)';
                  let bg = 'var(--bg-card)';
                  let status = null;
                  if (iAmMatched) {
                    border = 'var(--success)'; bg = 'rgba(34,197,94,0.12)';
                    status = { text: `✓ ${upcoming.peerName || 'Confirmed'}`, color: 'var(--success)' };
                  } else if (joined) {
                    border = 'var(--accent)'; bg = 'var(--accent-soft)';
                    status = { text: 'Pending', color: 'var(--accent)' };
                  } else if (hot) {
                    border = 'var(--warning-bg)'; bg = 'var(--warning)18';
                    status = { text: `${othersWaiting} waiting`, color: 'var(--warning)' };
                  } else if (!past) {
                    status = { text: 'I am free', color: 'var(--text-muted)' };
                  }

                  return (
                    <button
                      key={slotId}
                      type="button"
                      onClick={() => !past && toggleSlot(slotId, joined, iAmMatched)}
                      disabled={past || working}
                      aria-label={`${blockLabel(hour)} — ${joined ? 'cancel' : 'mark me free'}`}
                      style={{
                        textAlign: 'left', cursor: past ? 'default' : 'pointer',
                        borderRadius: '12px', padding: '10px 11px', minWidth: 0,
                        border: `1px solid ${border}`, background: bg,
                        opacity: past ? 0.4 : 1,
                        display: 'flex', flexDirection: 'column', gap: '3px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                        <span style={{
                          fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {hourLabel(hour)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          –{hourLabel((hour + 2) % 24)}
                        </span>
                        {popular && <Star size={11} strokeWidth={2} aria-label="Most people are here at this hour" style={{ color: 'var(--warning)' }} />}
                        {isNow && (
                          <span style={{
                            fontSize: '8px', fontWeight: 800, padding: '2px 5px', borderRadius: '20px',
                            background: 'var(--accent-soft)', color: 'var(--accent)', letterSpacing: '0.5px',
                          }}>NOW</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '12px', fontWeight: 600,
                        color: working ? 'var(--text-muted)' : (status ? status.color : 'var(--text-muted)'),
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {working ? '...' : past ? 'Passed' : (status ? status.text : '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Təkrarlanan vaxtlar — yığcam, açılıb-bağlanan bölmə. */}
          <button
            type="button"
            onClick={() => setRecurOpen((v) => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
              background: 'none', border: 'none', padding: '8px 2px 4px', cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <Repeat size={14} />
            <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, textAlign: 'left' }}>
              Repeat every day
            </span>
            {recurringHours.size > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                background: 'var(--accent-soft)', color: 'var(--accent)',
              }}>
                {recurringHours.size}
              </span>
            )}
            {recurOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {recurOpen && (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 2px 8px', lineHeight: 1.5 }}>
                The hours you pick are marked as free automatically, every day.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {SLOT_BLOCK_HOURS.map((hour) => {
                  const on = recurringHours.has(hour);
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => toggleRecurring(hour)}
                      disabled={busy === `rec-${hour}`}
                      style={{
                        padding: '8px 4px', borderRadius: '9px', cursor: 'pointer',
                        fontSize: '12px', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                        border: on ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: on ? 'var(--accent-soft)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {busy === `rec-${hour}` ? '...' : hourLabel(hour)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

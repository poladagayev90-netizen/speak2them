import React, { useEffect, useState } from 'react';
import { parseSlotId, dayLabel, hourLabel } from '../utils/practiceSlots';

// Təsdiqlənmiş randevu — ana səhifənin ƏSAS elementi.
//
// Əvvəl bu, adi boz düzbucaqlı idi və ekranda gözə dəymirdi. Halbuki bu kart
// məhsulun bütün vədini daşıyır: "bu gün saat 20:00-da səni kimsə gözləyir".
// Ona görə vizual ağırlıq buradadır — gradient, avatar, iri saat və canlı
// geri sayım. Ciddi görünüş gəlmə ehtimalını qaldırır (Preply məntiqi).
//
// Ləğv düyməsi QƏSDƏN var və qəsdən ikinci dərəcəlidir: çıxış yolu olmayan
// randevu istifadəçini sıxır və nəticədə heç kim slot qoymur.
function countdownText(startMs, now) {
  const diff = startMs - now;
  if (diff <= 0) return 'İndi';
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days} gün ${hours} saat`;
  if (hours > 0) return `${hours} saat ${mins} dəq`;
  return `${mins} dəq`;
}

export default function UpcomingCallCard({ call, onJoin, onCancel, busy }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!call) return null;

  const parsed = parseSlotId(call.slotId);
  const startMs = Number(call.startMs) || parsed?.startMs || 0;
  const when = parsed ? `${dayLabel(parsed.date, now)} ${hourLabel(parsed.hour)}` : '';
  const peerName = call.peerName || 'Partnyorunuz';
  const openable = now >= startMs - 5 * 60 * 1000;
  const live = now >= startMs;

  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, rgba(124,111,247,0.20), rgba(91,77,232,0.10))',
      border: `1px solid ${live ? 'var(--success)' : '#7c6ff7aa'}`,
      borderRadius: '18px',
      padding: '16px',
      marginBottom: '14px',
      boxShadow: live
        ? '0 0 0 1px rgba(34,197,94,0.25), 0 8px 26px rgba(34,197,94,0.14)'
        : '0 8px 26px rgba(124,111,247,0.18)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px', gap: '8px',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 800, letterSpacing: '1px',
          textTransform: 'uppercase', color: live ? 'var(--success)' : '#a99cff',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: live ? 'var(--success)' : '#a99cff', display: 'inline-block',
          }} />
          {live ? 'Praktika vaxtı' : 'Yaxınlaşan zəng'}
        </span>
        <span style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {countdownText(startMs, now)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #7c6ff7, #5b4de8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '19px', fontWeight: 800, color: '#fff',
        }}>
          {peerName.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)',
            lineHeight: 1.15, fontVariantNumeric: 'tabular-nums',
          }}>
            {when}
          </div>
          <div style={{
            fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {peerName} ilə
          </div>
        </div>
      </div>

      {/* Vaxt çatmayıbsa sönük "disabled" düymə göstərmirik — ekranda böyük
          boz ləkə qalır və kart sınıq görünür. Əvəzinə sakit izah sətri. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {openable ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={busy}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              fontSize: '14px', fontWeight: 800, cursor: busy ? 'default' : 'pointer',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
              color: '#fff',
            }}
          >
            🎙️ Zəngə keç
          </button>
        ) : (
          <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Vaxtı çatanda burada “Zəngə keç” düyməsi görünəcək.
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: openable ? '12px 16px' : '9px 14px', borderRadius: '10px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700,
            cursor: busy ? 'default' : 'pointer', flexShrink: 0,
          }}
        >
          {busy ? '...' : 'Ləğv et'}
        </button>
      </div>
    </div>
  );
}

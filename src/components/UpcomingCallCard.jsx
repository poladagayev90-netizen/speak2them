import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  parseSlotId, dayLabel, hourLabel, blockLabel, upcomingBlocks, proposeSlotChange, SLOT_BLOCK_MS,
} from '../utils/practiceSlots';

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
  if (diff <= 0) return 'Now';
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function UpcomingCallCard({ call, onJoin, onCancel, busy }) {
  const [now, setNow] = useState(Date.now());
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!call) return null;

  // Randevu blokunun sonu keçibsə kartı GÖSTƏRMƏ. upcomingCall yalnız əl ilə
  // ləğvdə təmizlənirdi (backend heç vaxt avtomatik silmirdi), ona görə heç kim
  // qoşulmayan köhnə zəng ekranda ilişib qalırdı ("Çərşənbə 20:00" günlərlə
  // dururdu). Blok bitəndən sonra bu, keçmiş öhdəlikdir — client burada susdurur;
  // backend (practiceSlotTick) də sənədi təmizləyir və xəbərdarlıq göndərir.
  const cardStartMs = Number(call.startMs) || parseSlotId(call.slotId)?.startMs || 0;
  if (cardStartMs && Date.now() > cardStartMs + SLOT_BLOCK_MS) return null;

  const propose = async (toSlotId) => {
    setSending(toSlotId);
    const res = await proposeSlotChange(call.slotId, toSlotId);
    setSending('');
    setPicking(false);
    setNotice(res.ok
      ? 'Request sent — the time changes once your partner accepts.'
      : `⚠️ ${res.errorText}`);
    setTimeout(() => setNotice(''), 8000);
  };

  const parsed = parseSlotId(call.slotId);
  const startMs = Number(call.startMs) || parsed?.startMs || 0;
  const when = parsed ? `${dayLabel(parsed.date, now)} ${hourLabel(parsed.date, parsed.hour)}` : '';
  const peerName = call.peerName || 'Partnyorunuz';
  const openable = now >= startMs - 5 * 60 * 1000;
  const live = now >= startMs;

  return (
    <div style={{
      position: 'relative',
      background: 'var(--accent-soft)',
      border: `1px solid ${live ? 'var(--accent)' : 'var(--accent-ring)'}`,
      borderRadius: '18px',
      padding: '16px',
      marginBottom: '14px',
      boxShadow: live ? '0 0 0 1px var(--accent-ring)' : 'var(--glass-lift)',
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
          {live ? 'Practice time' : 'Upcoming call'}
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
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '19px', fontWeight: 800, color: 'var(--text-on-accent)',
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
            {peerName} with
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
              background: 'var(--accent)',
              color: 'var(--text-on-accent)',
            }}
          >
            🎙️ Join the call
          </button>
        ) : (
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            The Join button appears here when it is time.
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
          {busy ? '...' : 'Cancel'}
        </button>
      </div>

      {/* Vaxtı dəyişmək TƏKBAŞINA mümkün deyil — təklif gedir, partnyor
          təsdiqləyir. Uzun müzakirə üçün chat düyməsi yanındadır.
          Altdan xətt QƏSDƏN yoxdur: veb-link görünüşü tətbiq içində ucuz
          görünür, ikinci dərəcəli hərəkət sakit çip kimi verilir. */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        {[
          { key: 'time', label: 'Change time', onClick: () => { setPicking((p) => !p); setNotice(''); } },
          { key: 'chat', label: 'Chat', onClick: () => navigate(`/chat/${call.peerUid}`) },
        ].map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            style={{
              padding: '7px 12px', borderRadius: '9px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {notice && (
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '10px', lineHeight: 1.5 }}>
          {notice}
        </div>
      )}

      {picking && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Pick a new time — your partner will get the request.
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px',
            maxHeight: '176px', overflowY: 'auto',
          }}>
            {upcomingBlocks(now, call.slotId).map((b) => (
              <button
                key={b.slotId}
                type="button"
                onClick={() => propose(b.slotId)}
                disabled={!!sending}
                style={{
                  padding: '7px 11px', borderRadius: '9px', fontSize: '12px', fontWeight: 700,
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-primary)', cursor: sending ? 'default' : 'pointer',
                  opacity: sending && sending !== b.slotId ? 0.5 : 1,
                }}
              >
                {sending === b.slotId
                  ? '...'
                  : `${dayLabel(b.date, now)} ${blockLabel(b.date, b.hour)}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

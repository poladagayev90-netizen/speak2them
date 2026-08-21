import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseSlotId, dayLabel, hourLabel, respondSlotChange } from '../utils/practiceSlots';

// Partnyorun vaxt dəyişikliyi təklifi.
//
// Rədd etmək TƏHLÜKƏSİZDİR: "yox" desən köhnə randevu olduğu kimi qalır, zəng
// itmir. Bu, rədd etməyi asanlaşdırır — əks halda insanlar uyğun olmayan vaxta
// razılıq verib sonra gəlmirlər.
//
// Uzun müzakirə üçün çat: "Yazışın" düyməsi birbaşa həmin söhbətə aparır, ona
// görə banner uzun izahlarla yüklənmir.
export default function SlotChangeBanner({ request, onDone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!request) return null;

  const from = parseSlotId(request.fromSlotId);
  const to = parseSlotId(request.toSlotId);
  const label = (s) => (s ? `${dayLabel(s.date)} ${hourLabel(s.hour)}` : '—');

  const respond = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    setError('');
    const res = await respondSlotChange(request.id, accept);
    setBusy('');
    if (!res.ok) { setError(res.errorText); return; }
    if (onDone) onDone();
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--warning)1f, #d977061a)',
      border: '1px solid var(--warning-bg)', borderRadius: '16px',
      padding: '16px', marginBottom: '12px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
        🕘 Time change request
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
        <b style={{ color: 'var(--text-primary)' }}>{request.proposerName || 'Partnyorunuz'}</b>{' '}
        call <b style={{ color: 'var(--text-primary)' }}>{label(from)}</b> from{' '}
        <b style={{ color: 'var(--text-primary)' }}>{label(to)}</b> to. If you decline, the original time stands.
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '10px' }}> {error}</div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={!!busy}
          style={{
            flex: 1, padding: '11px', borderRadius: '11px', border: 'none',
            background: 'var(--accent)',
            color: '#fff', fontSize: '14px', fontWeight: 800,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy === 'yes' ? '...' : 'Accept'}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={!!busy}
          style={{
            padding: '11px 14px', borderRadius: '11px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy === 'no' ? '...' : 'Not available'}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/chat/${request.proposerUid}`)}
          style={{
            padding: '11px 14px', borderRadius: '11px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          💬
        </button>
      </div>
    </div>
  );
}

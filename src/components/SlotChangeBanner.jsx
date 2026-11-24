import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MessageCircle } from 'lucide-react';
import { parseSlotId, dayLabel, hourLabel, respondSlotChange } from '../utils/practiceSlots';
import { practiceText } from '../data/practiceCopy';

// Partner's time-change request. Declining keeps the original booked slot safe.
export default function SlotChangeBanner({ request, onDone, lang = 'en' }) {
  const pt = (k, v) => practiceText(lang, k, v);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!request) return null;

  const from = parseSlotId(request.fromSlotId);
  const to = parseSlotId(request.toSlotId);
  const label = (s) => (s ? `${dayLabel(s.date, Date.now(), lang)} ${hourLabel(s.date, s.hour)}` : '—');
  const who = request.proposerName || pt('mo.yourPartner');

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
      background: 'var(--warning-bg)',
      border: '1px solid var(--warning)', borderRadius: '16px',
      padding: '16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
        <Clock size={16} aria-hidden="true" />
        <span>{pt('scb.title')}</span>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
        {pt('scb.body', { name: who, from: label(from), to: label(to) })}
      </div>

      {error && (
        <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '10px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={!!busy}
          style={{
            flex: 1, padding: '11px', borderRadius: '11px', border: 'none',
            background: 'var(--accent)',
            color: 'var(--text-on-accent)', fontSize: '14px', fontWeight: 800,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy === 'yes' ? '...' : pt('scb.accept')}
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
          {busy === 'no' ? '...' : pt('scb.decline')}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/chat/${request.proposerUid}`)}
          aria-label={pt('bk.message')}
          style={{
            padding: '11px 14px', borderRadius: '11px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

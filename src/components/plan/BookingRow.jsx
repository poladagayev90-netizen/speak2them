import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MessageCircle, X, Clock } from 'lucide-react';
import { Button } from '../ui';
import { whenLabel, countdownLabel, canJoin, peerOf, joinState } from '../../utils/planState';
import { leavePracticeSlot, proposeSlotChange, upcomingBlocks, dayLabel, blockLabel } from '../../utils/practiceSlots';
import './plan.css';

const LATE_CANCEL_MS = 2 * 60 * 60 * 1000;

// One booked practice on the Plan tab: join, message, change the time (a
// request the partner accepts), or cancel.
//
// Cancelling stays possible and one step away — a commitment with no exit
// makes people stop booking at all. It does say what a late cancel means,
// because the partner has kept that hour free; the partner's message carries
// no name and no blame (leavePracticeSlot).
export default function BookingRow({ booking, uid, now }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState(null);
  const { peerUid, peerName, peerLevel } = peerOf(booking, uid);
  const joinable = canJoin(booking, now);
  const late = Number(booking.startMs) - now < LATE_CANCEL_MS;

  const cancel = async () => {
    const ask = late
      ? `Cancel the practice with ${peerName}? It starts in less than two hours, so ${peerName} has already kept this time free for you.`
      : `Cancel the practice with ${peerName}? They will be told the time is free again.`;
    if (!window.confirm(ask)) return;
    setBusy('cancel');
    const res = await leavePracticeSlot(booking.slotId);
    setBusy('');
    setNotice(res.ok ? { ok: true, text: 'Cancelled.' } : { ok: false, text: res.errorText });
  };

  const move = async (toSlotId) => {
    setBusy(toSlotId);
    const res = await proposeSlotChange(booking.slotId, toSlotId);
    setBusy('');
    setPicking(false);
    setNotice(res.ok
      ? { ok: true, text: `Request sent. The time changes once ${peerName} accepts.` }
      : { ok: false, text: res.errorText });
  };

  return (
    <div className="pl-booking">
      <div className="pl-booking-top">
        <span className="pl-row-main">
          <p className="pl-row-title">{whenLabel(booking.startMs, now)}</p>
          <p className="pl-row-sub">
            with {peerName}{peerLevel ? ` · ${String(peerLevel).slice(0, 2)}` : ''} · {countdownLabel(booking.startMs, now)}
          </p>
        </span>
      </div>
      <div className="pl-actions">
        {joinable && (
          <Button size="sm" icon={<Mic size={16} aria-hidden="true" />} onClick={() => navigate(`/chat/${peerUid}`, { state: joinState(booking) })}>
            Join
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={<MessageCircle size={16} aria-hidden="true" />} onClick={() => navigate(`/chat/${peerUid}`)}>
          Message
        </Button>
        {!joinable && (
          <Button size="sm" variant="ghost" icon={<Clock size={16} aria-hidden="true" />} onClick={() => { setPicking((p) => !p); setNotice(null); }}>
            Change time
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<X size={16} aria-hidden="true" />} onClick={cancel} disabled={!!busy}>
          {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </Button>
      </div>
      {picking && (
        <>
          <p className="pl-notice">Pick a new time — {peerName} gets the request.</p>
          <div className="pl-slots">
            {upcomingBlocks(now, booking.slotId).map((b) => (
              <button key={b.slotId} type="button" className="pl-slot" disabled={!!busy} onClick={() => move(b.slotId)}>
                {busy === b.slotId ? '…' : `${dayLabel(b.date, now)} ${blockLabel(b.date, b.hour)}`}
              </button>
            ))}
          </div>
        </>
      )}
      {notice && <p className={`pl-notice ${notice.ok ? '' : 'pl-notice--error'}`} role="status">{notice.text}</p>}
    </div>
  );
}

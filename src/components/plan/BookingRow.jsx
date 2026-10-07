import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MessageCircle, X, Clock, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui';
import { countdownLabel, canJoin, peerOf, joinState } from '../../utils/planState';
import { leavePracticeSlot, proposeSlotChange } from '../../utils/practiceSlots';
import SlotPicker from './SlotPicker';
import './plan.css';

const LATE_CANCEL_MS = 2 * 60 * 60 * 1000;

// One booked practice on the Plan tab: join, message, change the time (a
// request the partner accepts), or cancel.
//
// Cancelling stays possible and one step away — a commitment with no exit
// makes people stop booking at all. It does say what a late cancel means,
// because the partner has kept that hour free; the partner's message carries
// no name and no blame (leavePracticeSlot).
// `autoOpen`: another screen sent the learner to THIS practice — 'more' (Today's
// Coming up) opens its actions, 'time' (Partners → change the time) its time
// picker as well.
export default function BookingRow({ booking, uid, now, autoOpen = null }) {
  const navigate = useNavigate();
  const joinable = canJoin(booking, now);
  const [busy, setBusy] = useState('');
  const [picking, setPicking] = useState(autoOpen === 'time' && !joinable);
  const [more, setMore] = useState(!!autoOpen);
  const [notice, setNotice] = useState(null);
  const { peerUid, peerName, peerLevel } = peerOf(booking, uid);
  const ref = useRef(null);
  useEffect(() => {
    if (autoOpen && ref.current?.scrollIntoView) ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [autoOpen]);
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

  const time = new Date(Number(booking.startMs)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const countdown = countdownLabel(booking.startMs, now);

  // A ticket: the time is the headline (the day is already in the column on
  // the left), then the person, then what you can do. Join is the one filled
  // button and only appears when it works; changing the time and cancelling
  // are one tap further, behind "More", because they are the rare actions.
  return (
    <div ref={ref} className={`pl-booking pl-ticket ${joinable ? 'is-live' : ''}`}>
      <div className="pl-ticket-top">
        <p className="pl-ticket-time">{time}</p>
        <span className="pl-ticket-count">{joinable ? 'Now' : countdown}</span>
      </div>
      <p className="pl-ticket-person">
        <span className="pl-ticket-avatar" aria-hidden="true">{String(peerName || '?').charAt(0).toUpperCase()}</span>
        <b>{peerName}</b>
        {peerLevel && <span className="pl-level">{String(peerLevel).slice(0, 2)}</span>}
      </p>
      <div className="pl-actions">
        {joinable && (
          <Button size="sm" icon={<Mic size={16} aria-hidden="true" />} onClick={() => navigate(`/chat/${peerUid}`, { state: joinState(booking) })}>
            Join
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={<MessageCircle size={16} aria-hidden="true" />} onClick={() => navigate(`/chat/${peerUid}`)}>
          Message
        </Button>
        <Button size="sm" variant="ghost" icon={<MoreHorizontal size={16} aria-hidden="true" />}
          aria-expanded={more} onClick={() => { setMore((v) => !v); setPicking(false); setNotice(null); }}>
          More
        </Button>
      </div>
      {more && (
        <div className="pl-ticket-more">
          {!joinable && (
            <button type="button" className="pl-ticket-link" onClick={() => { setPicking((p) => !p); setNotice(null); }}>
              <Clock size={15} aria-hidden="true" /> Change the time
            </button>
          )}
          <button type="button" className="pl-ticket-link pl-ticket-link--danger" onClick={cancel} disabled={!!busy}>
            <X size={15} aria-hidden="true" /> {busy === 'cancel' ? 'Cancelling…' : 'Cancel this practice'}
          </button>
        </div>
      )}
      {picking && (
        <>
          <p className="pl-notice">Pick a new time — {peerName} gets the request.</p>
          <SlotPicker nowMs={now} excludeSlotId={booking.slotId} busySlotId={busy} disabled={!!busy} onPick={move} />
        </>
      )}
      {notice && <p className={`pl-notice ${notice.ok ? '' : 'pl-notice--error'}`} role="status">{notice.text}</p>}
    </div>
  );
}

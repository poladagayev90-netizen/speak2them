import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MessageCircle, X, Clock, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui';
import { countdownLabel, canJoin, peerOf, joinState } from '../../utils/planState';
import { leavePracticeSlot, proposeSlotChange } from '../../utils/practiceSlots';
import { practiceText } from '../../data/practiceCopy';
import SlotPicker from './SlotPicker';
import AddToCalendar from './AddToCalendar';
import { ReasonPicker } from './MissReason';
import './plan.css';

const LATE_CANCEL_MS = 2 * 60 * 60 * 1000;

export default function BookingRow({ booking, uid, now, autoOpen = null, onboarding = null, lang = 'en' }) {
  const pt = (k, v) => practiceText(lang, k, v);
  const navigate = useNavigate();
  const joinable = canJoin(booking, now);
  const [busy, setBusy] = useState('');
  const [picking, setPicking] = useState(autoOpen === 'time' && !joinable);
  const [more, setMore] = useState(!!autoOpen);
  const [notice, setNotice] = useState(null);
  const [askWhy, setAskWhy] = useState(null);
  const { peerUid, peerName } = peerOf(booking, uid);
  const ref = useRef(null);
  useEffect(() => {
    if (autoOpen && ref.current?.scrollIntoView) ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [autoOpen]);
  const late = Number(booking.startMs) - now < LATE_CANCEL_MS;

  const cancel = async () => {
    const ask = late ? pt('bk.confirmLate', { name: peerName }) : pt('bk.confirmEarly', { name: peerName });
    if (!window.confirm(ask)) return;
    setBusy('cancel');
    const res = await leavePracticeSlot(booking.slotId);
    setBusy('');
    setNotice(res.ok ? { ok: true, text: pt('bk.cancelled') } : { ok: false, text: res.errorText });
  };

  const move = async (toSlotId) => {
    setBusy(toSlotId);
    const res = await proposeSlotChange(booking.slotId, toSlotId);
    setBusy('');
    setPicking(false);
    setNotice(res.ok
      ? { ok: true, text: pt('bk.moveSent', { name: peerName }) }
      : { ok: false, text: res.errorText });
    if (res.ok) setAskWhy(`change_${booking.slotId}_${toSlotId}`);
  };

  const time = new Date(Number(booking.startMs)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const countdown = countdownLabel(booking.startMs, now, lang);

  return (
    <div ref={ref} className={`pl-booking pl-ticket ${joinable ? 'is-live' : ''}`}>
      <div className="pl-ticket-top">
        <p className="pl-ticket-time">{time}</p>
        <span className="pl-ticket-count">{joinable ? pt('count.now') : countdown}</span>
      </div>
      <p className="pl-ticket-person">
        <span className="pl-ticket-avatar" aria-hidden="true">{String(peerName || '?').charAt(0).toUpperCase()}</span>
        <b>{peerName}</b>
      </p>
      <div className="pl-actions">
        {joinable && (
          <Button size="sm" icon={<Mic size={16} aria-hidden="true" />} onClick={() => navigate(`/chat/${peerUid}`, { state: joinState(booking) })}>
            {pt('bk.join')}
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={<MessageCircle size={16} aria-hidden="true" />} onClick={() => navigate(`/chat/${peerUid}`)}>
          {pt('bk.message')}
        </Button>
        <Button size="sm" variant="ghost" icon={<MoreHorizontal size={16} aria-hidden="true" />}
          aria-expanded={more} onClick={() => { setMore((v) => !v); setPicking(false); setNotice(null); }}>
          {pt('bk.more')}
        </Button>
      </div>
      {more && (
        <div className="pl-ticket-more">
          {!joinable && (
            <button type="button" className="pl-ticket-link" onClick={() => { setPicking((p) => !p); setNotice(null); }}>
              <Clock size={15} aria-hidden="true" /> {pt('bk.changeTime')}
            </button>
          )}
          {!joinable && <AddToCalendar booking={booking} peerName={peerName} lang={lang} />}
          <button type="button" className="pl-ticket-link pl-ticket-link--danger" onClick={cancel} disabled={!!busy}>
            <X size={15} aria-hidden="true" /> {busy === 'cancel' ? pt('bk.cancelling') : pt('bk.cancel')}
          </button>
        </div>
      )}
      {picking && (
        <>
          <p className="pl-notice">{pt('bk.pickNew', { name: peerName })}</p>
          <SlotPicker nowMs={now} excludeSlotId={booking.slotId} busySlotId={busy} disabled={!!busy} lang={lang} onPick={move} />
        </>
      )}
      {notice && <p className={`pl-notice ${notice.ok ? '' : 'pl-notice--error'}`} role="status">{notice.text}</p>}
      {askWhy && (
        <div className="mr-inline">
          <p className="mr-sub">{pt('bk.whyOldTime')}</p>
          <ReasonPicker compact uid={uid} kind="time_change" eventId={askWhy} slotId={booking.slotId}
            onboarding={onboarding} lang={lang} onDone={() => setAskWhy(null)} onSkip={() => setAskWhy(null)} />
        </div>
      )}
    </div>
  );
}

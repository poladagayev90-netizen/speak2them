import React, { useEffect, useState } from 'react';
import { CalendarClock, Check, Clock } from 'lucide-react';
import { Button } from './ui';
import {
  subscribeToMyOffers, respondToOffer, localBlockLabel, DECLINE_REASONS,
} from '../utils/matchOffers';
import './MatchOfferCard.css';

// A practice the SpeakLab team proposed. It is a QUESTION, not a booking: the
// call exists only once both people confirm, and the card says so plainly —
// that sentence is what keeps a "yes" from turning into a broken promise when
// the other person cannot make it.
//
// Declining is one tap plus an optional reason. The reason goes to the team
// only; the partner is never told who said no.
export default function MatchOfferCard({ uid }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => subscribeToMyOffers(uid, setOffers), [uid]);

  const live = offers.filter((o) => Number(o.startMs) > Date.now());
  if (!live.length) return null;
  return live.map((o) => <OfferItem key={o.id} offer={o} uid={uid} />);
}

function OfferItem({ offer, uid }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('not-free');

  const mine = (offer.responses || {})[uid];
  const isA = offer.userA === uid;
  const peerName = (isA ? offer.nameB : offer.nameA) || 'your partner';
  const peerLevel = isA ? offer.levelB : offer.levelA;
  const { day, time } = localBlockLabel(Number(offer.startMs));

  const respond = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    setError('');
    const res = await respondToOffer(offer.id, accept, accept ? undefined : reason);
    setBusy('');
    if (!res.ok) setError(res.errorText);
    // Success needs no local state: the live query drops a closed offer and
    // a confirmed one reappears as the upcoming-call card.
  };

  if (mine === 'accepted') {
    return (
      <section className="mo mo--waiting" aria-live="polite">
        <span className="mo-icon" aria-hidden="true"><Check size={18} /></span>
        <div className="mo-body">
          <p className="mo-title">You confirmed {day.toLowerCase() === 'today' ? 'today' : day} {time}</p>
          <p className="mo-text">Waiting for {peerName}. You will get a notification the moment it is booked.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mo" aria-label="Practice proposal">
      <div className="mo-head">
        <span className="mo-icon" aria-hidden="true"><CalendarClock size={18} /></span>
        <span className="mo-kicker">Practice proposal from the SpeakLab team</span>
      </div>

      <p className="mo-when">
        <span className="mo-day">{day}</span>
        <span className="mo-time">{time}</span>
      </p>
      <p className="mo-with">
        with <b>{peerName}</b>
        {peerLevel && <span className="mo-level">{String(peerLevel).slice(0, 2)}</span>}
      </p>
      {offer.note && <p className="mo-note">{offer.note}</p>}
      <p className="mo-text">
        <Clock size={14} aria-hidden="true" /> Booked only when you both confirm.
      </p>

      {error && <p className="mo-error" role="alert">{error}</p>}

      {!declining ? (
        <div className="mo-actions">
          <Button full onClick={() => respond(true)} disabled={!!busy}>
            {busy === 'yes' ? 'Confirming…' : 'Confirm'}
          </Button>
          <Button variant="secondary" onClick={() => setDeclining(true)} disabled={!!busy}>
            I can’t make it
          </Button>
        </div>
      ) : (
        <div className="mo-decline">
          <p className="mo-text">What is the reason? Only the SpeakLab team sees this.</p>
          <div className="mo-reasons" role="radiogroup" aria-label="Reason">
            {DECLINE_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                className={`mo-reason ${reason === r.value ? 'is-on' : ''}`}
                onClick={() => setReason(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="mo-actions">
            <Button variant="secondary" full onClick={() => respond(false)} disabled={!!busy}>
              {busy === 'no' ? 'Sending…' : 'Send'}
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(false)} disabled={!!busy}>Back</Button>
          </div>
        </div>
      )}
    </section>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from './ui';
import {
  subscribeToMyOffers, respondToOffer, localBlockLabel, DECLINE_REASONS,
} from '../utils/matchOffers';
import HeroParade, { heroClockStyle } from './plan/HeroFx';
import './plan/plan.css';
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
  const clock = useMemo(heroClockStyle, []);

  const mine = (offer.responses || {})[uid];
  const isA = offer.userA === uid;
  const peerName = (isA ? offer.nameB : offer.nameA) || 'your partner';
  const peerLevel = isA ? offer.levelB : offer.levelA;
  const { day, time } = localBlockLabel(Number(offer.startMs));
  const [start, end] = time.split('–');
  const initial = String(peerName).charAt(0).toUpperCase();

  const respond = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    setError('');
    const res = await respondToOffer(offer.id, accept, accept ? undefined : reason);
    setBusy('');
    if (!res.ok) setError(res.errorText);
    // Success needs no local state: the live query drops a closed offer and
    // a confirmed one reappears as the upcoming-call card.
  };

  // Said yes, the partner has not yet: a quiet card — nothing to do but wait.
  if (mine === 'accepted') {
    return (
      <section className="mo mo--waiting" aria-live="polite" aria-label={`Waiting for ${peerName}`}>
        <span className="mo-avatar" aria-hidden="true">
          {initial}
          <span className="mo-avatar-check"><Check size={11} strokeWidth={3} /></span>
        </span>
        <div className="mo-body">
          <p className="mo-wait-when">{day} · {start}</p>
          <p className="mo-wait-text">
            <span className="mo-pulse" aria-hidden="true" />
            <span>You said yes · waiting for <b>{peerName}</b></span>
          </p>
        </div>
      </section>
    );
  }

  // Needs an answer: the same living card as Today's next practice, because
  // it is the one thing on the page that asks something of you.
  return (
    <section className="pl-card pl-card--hero mo-ask" style={clock} aria-label={`Practice proposal with ${peerName}`}>
      <HeroParade />
      <p className="pl-when mo-ask-when">
        {day}
        <span className="mo-ask-time">{start}</span>
      </p>
      <p className="mo-ask-range">Until {end} · your time</p>

      <div className="mo-person">
        <span className="mo-avatar mo-avatar--hero" aria-hidden="true">{initial}</span>
        <span className="mo-person-name">{peerName}</span>
        {peerLevel && <span className="pl-level">{String(peerLevel).slice(0, 2)}</span>}
      </div>
      {offer.note && <p className="mo-note">{offer.note}</p>}

      {error && <p className="mo-error" role="alert">{error}</p>}

      {!declining ? (
        <>
          <div className="pl-actions">
            <Button onClick={() => respond(true)} disabled={!!busy}>
              {busy === 'yes' ? 'Saving…' : 'Yes, I’ll be there'}
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(true)} disabled={!!busy}>
              Can’t make it
            </Button>
          </div>
          <p className="mo-fine">Booked once you both say yes.</p>
        </>
      ) : (
        <div className="mo-decline">
          <p className="mo-fine">What gets in the way? Only the SpeakLab team sees this.</p>
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
          <div className="pl-actions">
            <Button onClick={() => respond(false)} disabled={!!busy}>
              {busy === 'no' ? 'Sending…' : 'Send'}
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(false)} disabled={!!busy}>Back</Button>
          </div>
        </div>
      )}
    </section>
  );
}

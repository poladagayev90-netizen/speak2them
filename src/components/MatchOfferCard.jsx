import React, { useEffect, useMemo, useState } from 'react';
import { Check, CalendarClock as CalendarQuestion } from 'lucide-react';
import { Button } from './ui';
import {
  subscribeToMyOffers, respondToOffer, localBlockLabel, DECLINE_REASONS,
} from '../utils/matchOffers';
import { LEVELS } from '../utils/onboarding';
import { practiceText } from '../data/practiceCopy';
import HeroParade, { heroClockStyle } from './plan/HeroFx';
import './plan/plan.css';
import './MatchOfferCard.css';

const REASON_COPY_KEY = {
  'not-free': 'mo.reason.notFree',
  'prefer-another': 'mo.reason.another',
  'week-off': 'mo.reason.off',
};

// A practice the SpeakLab team proposed. It is a QUESTION, not a booking: the
// call exists only once both people confirm, and the card surfaces the real
// partner's CEFR level (when non-null; founder host stays badge-free) and
// whether the partner already accepted in Firestore.
export default function MatchOfferCard({ uid, lang = 'en' }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => subscribeToMyOffers(uid, setOffers), [uid]);

  const live = offers.filter((o) => Number(o.startMs) > Date.now());
  if (!live.length) return null;
  return live.map((o) => <OfferItem key={o.id} offer={o} uid={uid} lang={lang} />);
}

function OfferItem({ offer, uid, lang }) {
  const t = (key, vars) => practiceText(lang, key, vars);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('not-free');
  const clock = useMemo(heroClockStyle, []);

  const mine = (offer.responses || {})[uid];
  const isA = offer.userA === uid;
  const peerUid = isA ? offer.userB : offer.userA;
  const peerName = (isA ? offer.nameB : offer.nameA) || t('mo.yourPartner');
  // Real CEFR level from the offer document; founder host carries null (stays badge-free).
  const rawLevel = isA ? offer.levelB : offer.levelA;
  const peerLevel = rawLevel
    ? (LEVELS.find((l) => l.value === rawLevel)?.short || String(rawLevel).trim().slice(0, 6))
    : null;
  const otherAccepted = Boolean(peerUid && (offer.responses || {})[peerUid] === 'accepted');
  const { day, time } = localBlockLabel(Number(offer.startMs), lang);
  const [start, end] = time.split('–');
  const initial = String(peerName).charAt(0).toUpperCase();

  const respond = async (accept) => {
    setBusy(accept ? 'yes' : 'no');
    setError('');
    const res = await respondToOffer(offer.id, accept, accept ? undefined : reason);
    setBusy('');
    if (!res.ok) setError(res.errorText);
  };

  // Said yes, the partner has not yet: a quiet card — nothing to do but wait.
  if (mine === 'accepted') {
    return (
      <section className="mo mo--waiting" aria-live="polite" aria-label={t('mo.waiting', { name: peerName })}>
        <span className="mo-avatar" aria-hidden="true">
          {initial}
          <span className="mo-avatar-check"><Check size={11} strokeWidth={3} /></span>
        </span>
        <div className="mo-body">
          <p className="mo-wait-when">{day} · {start}</p>
          <p className="mo-wait-text">
            <span className="mo-pulse" aria-hidden="true" />
            <span>{t('mo.waiting', { name: peerName })}</span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pl-card pl-card--hero mo-ask" style={clock} aria-label={t('mo.wantsTo', { name: peerName })}>
      <HeroParade />
      <p className="pl-kicker"><CalendarQuestion size={16} aria-hidden="true" /> {t('mo.wantsTo', { name: peerName })}</p>
      <p className="pl-when mo-ask-when">
        {day}
        <span className="mo-ask-time">{start}</span>
      </p>
      <p className="mo-ask-range">{t('mo.until', { end })}</p>

      <div className="mo-person">
        <span className="mo-avatar mo-avatar--hero" aria-hidden="true">{initial}</span>
        <span className="mo-person-name">{peerName}</span>
        {peerLevel && <span className="mo-level">{peerLevel}</span>}
        {otherAccepted && (
          <span className="mo-confirmed">
            <Check size={12} strokeWidth={3} aria-hidden="true" />
            {t('mo.confirmedAlready', { name: peerName })}
          </span>
        )}
      </div>
      {offer.note && <p className="mo-note">{offer.note}</p>}

      {error && <p className="mo-error" role="alert">{error}</p>}

      {!declining ? (
        <>
          <div className="pl-actions">
            <Button onClick={() => respond(true)} disabled={!!busy}>
              {busy === 'yes' ? t('mo.saving') : t('mo.yesBtn')}
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(true)} disabled={!!busy}>
              {t('mo.cantMakeIt')}
            </Button>
          </div>
          <p className="mo-fine">{t('mo.bookedOnceBoth')}</p>
        </>
      ) : (
        <div className="mo-decline">
          <p className="mo-fine">{t('mo.reasonIntro')}</p>
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
                {REASON_COPY_KEY[r.value] ? t(REASON_COPY_KEY[r.value]) : r.label}
              </button>
            ))}
          </div>
          <div className="pl-actions">
            <Button onClick={() => respond(false)} disabled={!!busy}>
              {busy === 'no' ? t('mo.sending') : t('mo.send')}
            </Button>
            <Button variant="ghost" onClick={() => setDeclining(false)} disabled={!!busy}>{t('mo.back')}</Button>
          </div>
        </div>
      )}
    </section>
  );
}

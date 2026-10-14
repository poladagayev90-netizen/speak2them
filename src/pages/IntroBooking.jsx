import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Users, Video, Smartphone, MessageCircle } from 'lucide-react';
import { auth } from '../firebase';
import { whatsappLink } from '../constants';
import { Button } from '../components/ui';
import {
  subscribeToMyIntro, cancelIntro, introTimeLabel, introWhatsAppText, mustWriteWhatsApp, markWhatsAppOpened,
} from '../utils/intro';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import './Onboarding.css';
import './IntroBooking.css';

// Say hi to the SpeakLab team — the last screen of joining.
//
// WHATSAPP ONLY, for now (2026-09-28). Making every newcomer book an intro
// call and pick a time in the app caused problems, so this screen just opens
// the team's business WhatsApp with the learner's name and level written in,
// and anything else — an intro call, its time — is arranged there by hand.
// Calls do not wait for it (see INTRO_REQUIRED in utils/intro.js), but a
// NEWCOMER must write first: until they tap the WhatsApp button once, home
// sends them back here and this screen offers no way on (mustWriteWhatsApp).
//
// The team slot board is not offered here any more. A learner who booked a
// time before this change still sees that booking and can cancel it, so no
// reminder fires for a call nobody is expecting.
export default function IntroBooking({ user }) {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid || user?.uid;
  const [booking, setBooking] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Local, so the way on appears the moment they tap — the users doc echo
  // (introWhatsAppAt) arrives a beat later.
  const [wrote, setWrote] = useState(false);
  const mustWrite = mustWriteWhatsApp(user) && !wrote;
  // The last screen of the first run — in the learner's language, and so is
  // the WhatsApp message it types for them (the team answers in it).
  const { lang, t } = useFirstRunCopy(user?.guideLanguage);
  const waText = user?.name
    ? t('intro.waText', { name: user.name, level: user.level ? ` (${user.level})` : '' })
    : introWhatsAppText(user);

  useEffect(() => subscribeToMyIntro(uid, setBooking), [uid]);

  const done = !!user?.introDoneAt || booking?.status === 'done';
  const booked = !done && booking?.status === 'booked' && Number(booking.startMs) > Date.now() - 30 * 60000;

  const cancel = async () => {
    setBusy(true);
    setError('');
    const res = await cancelIntro();
    setBusy(false);
    if (!res.ok) setError(res.errorText);
  };

  const openWhatsApp = () => {
    window.open(whatsappLink(waText), '_blank', 'noopener');
    setWrote(true);
    markWhatsAppOpened(uid);
  };

  return (
    <div className="ob-page" lang={lang}>
      <header className="ob-top">
        {!mustWrite && (
          <button type="button" className="ob-back" onClick={() => navigate('/')} aria-label={t('intro.back')}>
            <ArrowLeft size={20} />
          </button>
        )}
        <span className="in-top-title">{t('intro.top')}</span>
      </header>

      <main className="ob-slide ob-slide--fwd">
        {booking === undefined ? <div className="ob-loading" aria-busy="true" /> : (
          <section className="ob-q">
            <span className="ob-q-icon" aria-hidden="true">{done ? <Check size={20} /> : <Users size={20} />}</span>

            {done && (
              <>
                <h1 className="ob-title">{t('intro.doneTitle')}</h1>
                <p className="ob-sub">{t('intro.doneSub')}</p>
              </>
            )}

            {booked && (
              <>
                <h1 className="ob-title">Your intro call is booked</h1>
                <p className="ob-sub">A short, friendly conversation with the SpeakLab team about your goals and your practice week.</p>
                <BookedCard booking={booking} />
                {error && <p className="ob-error" role="alert">{error}</p>}
                <div className="in-row">
                  <Button variant="ghost" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Cancel booking'}</Button>
                </div>
              </>
            )}

            {!done && !booked && (
              <>
                <h1 className="ob-title">{t('intro.title')}</h1>
                <p className="ob-sub">{mustWrite ? t('intro.subMust') : t('intro.sub')}</p>
              </>
            )}

            <button type="button" className="in-wa" onClick={openWhatsApp}>
              <MessageCircle size={20} aria-hidden="true" />
              <span>
                <b>{t('intro.wa')}</b>
                <small>{t('intro.waSub')}</small>
              </span>
            </button>
          </section>
        )}
      </main>

      <footer className="ob-foot">
        {mustWrite ? (
          <Button size="lg" full onClick={openWhatsApp} icon={<MessageCircle size={20} />}>
            {t('intro.wa')}
          </Button>
        ) : (
          <Button size="lg" full onClick={() => navigate('/')}>{t('intro.continue')}</Button>
        )}
      </footer>
    </div>
  );
}

function BookedCard({ booking }) {
  const { day, time } = introTimeLabel(Number(booking.startMs), booking.durationMin);
  const hasLink = /^https?:\/\//.test(booking.meetUrl || '');
  return (
    <div className="in-booked">
      <p className="in-booked-day">{day}</p>
      <p className="in-booked-time">{time}</p>
      {booking.hostName && <p className="in-booked-host">with {booking.hostName}</p>}
      {hasLink ? (
        <a className="in-booked-how" href={booking.meetUrl} target="_blank" rel="noopener noreferrer">
          <Video size={16} /> Join the video call at this time
        </a>
      ) : (
        <p className="in-booked-how"><Smartphone size={16} /> We will call you here in the app — keep notifications on.</p>
      )}
    </div>
  );
}

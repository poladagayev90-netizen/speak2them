import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Lock } from 'lucide-react';
import { needsIntro, subscribeToMyIntro, introTimeLabel } from '../utils/intro';
import './IntroCard.css';

// The intro call, surfaced where it matters.
//   variant "home": a quiet row on Today — book it, or when it is.
//   variant "lock": on Live, in place of search and the slot board, saying
//                   plainly why they are not there yet and how to open them.
// Renders nothing for anyone who does not need an intro.
export default function IntroCard({ user, variant = 'home' }) {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const need = needsIntro(user);
  useEffect(() => (need ? subscribeToMyIntro(user.uid, setBooking) : undefined), [need, user?.uid]);
  if (!need) return null;

  const booked = booking?.status === 'booked' && Number(booking.startMs) > Date.now() - 30 * 60000;
  const when = booked ? introTimeLabel(Number(booking.startMs), booking.durationMin) : null;

  if (variant === 'lock') {
    return (
      <section className="ic ic--lock">
        <span className="ic-icon" aria-hidden="true"><Lock size={20} /></span>
        <h2 className="ic-title">Live practice opens after your intro call</h2>
        <p className="ic-text">
          {booked
            ? `Your 15-minute call with the SpeakLab team: ${when.day}, ${when.time.split('–')[0]}. Right after it, random partners and the practice board open here.`
            : 'A short call with the SpeakLab team comes first: we get to know you and set up a practice plan. Book a time — it takes 15 minutes.'}
        </p>
        <button type="button" className="ic-cta" onClick={() => navigate('/intro')}>
          {booked ? 'See my booking' : 'Book my intro call'} <ChevronRight size={18} />
        </button>
      </section>
    );
  }

  return (
    <button type="button" className="ic ic--home" onClick={() => navigate('/intro')}>
      <span className="ic-icon" aria-hidden="true"><Users size={18} /></span>
      <span className="ic-body">
        <span className="ic-title">{booked ? 'Intro call with the team' : 'Meet the SpeakLab team'}</span>
        <span className="ic-text">
          {booked ? `${when.day} · ${when.time}` : 'Book a 15-minute intro — live practice opens after it'}
        </span>
      </span>
      <ChevronRight size={18} className="ic-chev" aria-hidden="true" />
    </button>
  );
}

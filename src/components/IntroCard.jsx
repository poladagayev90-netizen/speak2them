import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Lock, ArrowRight } from 'lucide-react';
import Button from './ui/Button';
import { needsIntro, subscribeToMyIntro, introTimeLabel } from '../utils/intro';
import './IntroCard.css';

// The intro call, surfaced where it matters.
//   variant "home": the FIRST THING on Today while the intro is still to do —
//                   it is the step that opens live practice, so it is the
//                   one-next-step card, not a quiet row among six others.
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
            : 'A short call with the SpeakLab team comes first: we get to know you and set up a practice plan. Write to us on WhatsApp and we agree a time — it takes 15 minutes.'}
        </p>
        <button type="button" className="ic-cta" onClick={() => navigate('/intro')}>
          {booked ? 'See my booking' : 'Arrange my intro call'} <ChevronRight size={18} />
        </button>
      </section>
    );
  }

  return (
    <section className="ic ic--hero">
      <div className="ic-hero-head">
        <span className="ic-icon" aria-hidden="true"><Users size={20} /></span>
        <span className="ic-body">
          <span className="ic-eyebrow">{booked ? 'Booked' : 'Your first step'}</span>
          <span className="ic-title">{booked ? 'Your intro call with the team' : 'Meet the SpeakLab team'}</span>
        </span>
      </div>
      <p className="ic-text">
        {booked
          ? `${when.day} · ${when.time}. Right after it, live practice with partners opens.`
          : 'A 15-minute call on WhatsApp. We get to know you and set up your practice plan, then live practice with partners opens.'}
      </p>
      <Button
        size="lg"
        full
        onClick={() => navigate('/intro')}
        iconRight={<ArrowRight size={20} strokeWidth={2} />}
      >
        {booked ? 'See my booking' : 'Arrange my intro call'}
      </Button>
    </section>
  );
}

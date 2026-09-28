import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Lock, MessageCircle } from 'lucide-react';
import { whatsappLink } from '../constants';
import {
  needsIntro, subscribeToMyIntro, introTimeLabel, introWhatsAppText,
} from '../utils/intro';
import './IntroCard.css';

// The intro call, surfaced where it matters.
//   variant "home": a quiet row on Today — opens the team's WhatsApp (or,
//                   for a booking made earlier, shows when it is).
//   variant "lock": on Live, in place of search and the slot board, saying
//                   plainly why they are not there yet and how to open them.
//                   Only reached while INTRO_REQUIRED (utils/intro.js) is on.
// Renders nothing for anyone who does not need an intro.
export default function IntroCard({ user, variant = 'home' }) {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const need = needsIntro(user);
  useEffect(() => (need ? subscribeToMyIntro(user.uid, setBooking) : undefined), [need, user?.uid]);
  if (!need) return null;
  // Already wrote to the team and nothing booked: the row has done its job.
  if (variant === 'home' && user.introWhatsAppAt && !(booking?.status === 'booked')) return null;

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
    <button
      type="button"
      className="ic ic--home"
      onClick={() => (booked
        ? navigate('/intro')
        : window.open(whatsappLink(introWhatsAppText(user)), '_blank', 'noopener'))}
    >
      <span className="ic-icon" aria-hidden="true">{booked ? <Users size={18} /> : <MessageCircle size={18} />}</span>
      <span className="ic-body">
        <span className="ic-title">{booked ? 'Intro call with the team' : 'Say hi to the SpeakLab team'}</span>
        <span className="ic-text">
          {booked ? `${when.day} · ${when.time}` : 'Write to us on WhatsApp — goals, questions, your practice plan'}
        </span>
      </span>
      <ChevronRight size={18} className="ic-chev" aria-hidden="true" />
    </button>
  );
}

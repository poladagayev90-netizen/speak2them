import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, CalendarClock, CalendarDays, Mic, MessageCircle, PauseCircle, Sparkles, Trophy, UsersRound,
} from 'lucide-react';
import { Button } from '../ui';
import { whenLabel, countdownLabel, joinState, limitText } from '../../utils/planState';
import { setPlanPaused } from '../../hooks/useMyPlan';
import HeroParade, { heroClockStyle } from './HeroFx';
import './plan.css';

// The first thing on Today: the answer to "what should I do now?".
//
// ONE card, whatever the state. With a booking it is the booking — who, when,
// and a Join button that appears five minutes before. Without one it never
// goes blank: it says what is happening (proposals waiting, the plan arriving
// on Sunday, why no partner fits yet) and offers the one useful next step.
// The wording is planHeadline's (utils/planState.js); nothing here promises a
// partner the platform may not have.
export default function NextPracticeCard({ uid, headline, now, limit }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  // Phase from the clock, fixed for this mount (see HeroFx).
  const clock = useMemo(heroClockStyle, []);
  const h = headline || { kind: 'waiting' };
  // A reliability limit rides along in every state: why, and the way back.
  const lim = limitText(limit);
  const limitLine = lim && <p className="pl-hint"><b>{lim.title}.</b> {lim.text}</p>;

  if (h.kind === 'next') {
    const b = h.booking;
    const live = now >= b.startMs;
    return (
      <section id="tour-next" className={`pl-card pl-card--hero ${h.joinable ? 'pl-card--live' : ''}`} style={clock} aria-label="Your next practice">
        <HeroParade />
        <p className="pl-kicker">
          <CalendarCheck size={16} aria-hidden="true" />
          {live ? 'Practice time' : 'Your next practice'}
          <span className="pl-kicker-end">{countdownLabel(b.startMs, now)}</span>
        </p>
        <p className="pl-when">{whenLabel(b.startMs, now)}</p>
        <p className="pl-with">
          with <b>{h.peerName}</b>
          {h.peerLevel && <span className="pl-level">{String(h.peerLevel).slice(0, 2)}</span>}
        </p>
        <div className="pl-actions">
          {h.joinable && (
            <Button icon={<Mic size={18} aria-hidden="true" />} onClick={() => navigate(`/chat/${h.peerUid}`, { state: joinState(b) })}>
              Join the call
            </Button>
          )}
          <Button variant="secondary" icon={<MessageCircle size={18} aria-hidden="true" />} onClick={() => navigate(`/chat/${h.peerUid}`)}>
            Message
          </Button>
          <Button variant="ghost" onClick={() => navigate('/plan')}>My week</Button>
        </div>
        {!h.joinable && <p className="pl-hint">The Join button appears here five minutes before the start.</p>}
        {limitLine}
      </section>
    );
  }

  const simple = {
    answer: {
      icon: CalendarClock,
      title: `${h.count} ${h.count === 1 ? 'practice needs' : 'practices need'} your answer`,
      text: 'Each one is booked once you and your partner both say yes.',
      action: { label: 'Review', onClick: () => navigate('/plan') },
    },
    setup: {
      icon: CalendarDays,
      title: 'Set up your practice plan',
      text: 'Tell us when you are free and how many practices a week you want. Every Sunday evening you get a plan with real partners.',
      action: { label: 'Set up my plan', onClick: () => navigate('/onboarding', { state: { jumpTo: 'charter', returnTo: '/' } }) },
    },
    paused: {
      icon: PauseCircle,
      title: 'Your plan is paused',
      text: 'No new practices are planned for you until you switch it back on.',
      action: {
        label: busy ? 'Resuming…' : 'Resume my plan',
        onClick: async () => { setBusy(true); await setPlanPaused(uid, false).catch(() => {}); setBusy(false); },
      },
    },
    done: {
      icon: Trophy,
      title: 'Weekly goal reached',
      text: `${h.attended} of ${h.target} practices done. Anything more this week is a bonus.`,
      action: { label: 'Message a partner', onClick: () => navigate('/chats') },
    },
    no_match: {
      icon: UsersRound,
      title: 'No partner at your times yet',
      text: h.text,
      action: { label: 'Edit my free times', onClick: () => navigate('/onboarding', { state: { jumpTo: 'availability', returnTo: '/' } }) },
    },
    waiting: {
      icon: Sparkles,
      title: 'Your next plan arrives on Sunday evening',
      text: 'You will get your practices for the week to confirm. Want to talk sooner? Message someone you have practised with.',
      action: { label: 'Partners', onClick: () => navigate('/chats') },
    },
  }[h.kind] || null;
  if (!simple) return null;
  const Icon = simple.icon;

  return (
    // Every state wears the hero: Polad (2026-09-30) saw the drifting card only
    // as the admin ("Set up your plan") — learners mostly get "waiting" or
    // "done", which were plain white cards. The words change, the card doesn't.
    <section id="tour-next" className="pl-card pl-card--hero" style={clock} aria-label="Your practice">
      <HeroParade />
      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        <span className="pl-row-icon" aria-hidden="true"><Icon size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="pl-title">{simple.title}</p>
          <p className="pl-text">{simple.text}</p>
        </div>
      </div>
      <div className="pl-actions">
        <Button
          variant="primary"
          onClick={simple.action.onClick}
          disabled={busy}
        >
          {simple.action.label}
        </Button>
      </div>
      {limitLine}
    </section>
  );
}

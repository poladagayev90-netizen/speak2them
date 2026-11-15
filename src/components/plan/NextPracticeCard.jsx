import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, CalendarClock, CalendarDays, Mic, MessageCircle, PauseCircle, Sparkles, Trophy, UsersRound,
} from 'lucide-react';
import { Button } from '../ui';
import { joinState } from '../../utils/planState';
import { setPlanPaused, saveWeek, addFreeBlock, usePopularTimes } from '../../hooks/useMyPlan';
import { popularSuggestion } from '../../utils/myWeek';
import { practiceText, practiceDayNames } from '../../data/practiceCopy';
import { offsetVsBaku } from '../../utils/timezone';
import HeroParade, { heroClockStyle } from './HeroFx';
import AddToCalendar from './AddToCalendar';
import './plan.css';

// The first thing on Today: the answer to "what should I do now?".
//
// ONE card, whatever the state. With a booking it is the booking — who, when,
// and a Join button that appears five minutes before. Without one it never
// goes blank: it says what is happening (proposals waiting, the plan arriving
// on Sunday, why no partner fits yet) and offers the one useful next step.
// The wording is planHeadline's (utils/planState.js); nothing here promises a
// partner the platform may not have.
//
// `lang` (az/tr/ru/en, the first-run language) picks the words — the practice
// path speaks the learner's language (data/practiceCopy.js, 2026-11-15).
const LOCALES = { az: 'az', tr: 'tr', ru: 'ru', en: 'en-GB' };

// planState.whenLabel / countdownLabel / limitText, in the learner's language.
function whenText(lang, startMs, now) {
  const d = new Date(Number(startMs));
  const same = (a, b) => a.toDateString() === b.toDateString();
  let day;
  if (same(d, new Date(now))) day = practiceText(lang, 'today');
  else if (same(d, new Date(now + 86400000))) day = practiceText(lang, 'tomorrow');
  else {
    try { day = d.toLocaleDateString(LOCALES[lang] || 'en-GB', { weekday: 'long' }); } catch { day = d.toLocaleDateString('en-GB', { weekday: 'long' }); }
    day = day.charAt(0).toLocaleUpperCase() + day.slice(1);
  }
  return `${day} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}
function countdownText(lang, startMs, now) {
  const diff = Number(startMs) - now;
  if (diff <= 0) return practiceText(lang, 'count.now');
  const min = Math.floor(diff / 60000);
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  if (d > 0) return practiceText(lang, 'count.dh', { d, h });
  if (h > 0) return practiceText(lang, 'count.hm', { h, m });
  return practiceText(lang, 'count.m', { m });
}
function limitLines(lang, limit) {
  if (!limit || !limit.active) return null;
  return {
    title: practiceText(lang, 'limit.title'),
    text: practiceText(lang, 'limit.text', {
      missed: Math.max(1, Number(limit.missed) || 1),
      left: Math.max(1, Number(limit.recoverLeft) || 1),
      usual: Math.max(1, Number(limit.usualTarget) || 1),
    }),
  };
}
// popularSuggestion's "Tue 19:00", with the weekday in the learner's language.
const tipLabel = (lang, tip) => `${practiceText(lang, `day.${tip.day}`)} ${String(Math.floor(tip.startMin / 60)).padStart(2, '0')}:${String(tip.startMin % 60).padStart(2, '0')}`;

export default function NextPracticeCard({ uid, headline, now, limit, noPractices = false, onboarding = null, hasPartners = true, lang = 'en' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  // Phase from the clock, fixed for this mount (see HeroFx).
  const clock = useMemo(heroClockStyle, []);
  const h = headline || { kind: 'waiting' };
  const t = (key, vars) => practiceText(lang, key, vars);
  // A reliability limit rides along in every state: why, and the way back.
  const lim = limitLines(lang, limit);
  const limitLine = (
    <>
      {lim && <p className="pl-hint"><b>{lim.title}.</b> {lim.text}</p>}
      {/* Packages (utils/packages.js): one quiet line, only while the admin's
          switch is on and nothing is left — never a popup. */}
      {noPractices && (
        <p className="pl-hint">
          <b>{t('packages.none')}</b>{' '}
          <button type="button" className="pl-hint-link" onClick={() => navigate('/packages')}>{t('packages.see')}</button>
        </p>
      )}
    </>
  );

  if (h.kind === 'next') {
    const b = h.booking;
    const live = now >= b.startMs;
    return (
      <section id="tour-next" className={`pl-card pl-card--hero ${h.joinable ? 'pl-card--live' : ''}`} style={clock} aria-label="Your next practice">
        <HeroParade />
        {/* lang: CSS uppercase needs it for Turkish İ (see TopicCard). */}
        <p className="pl-kicker" lang={lang}>
          <CalendarCheck size={16} aria-hidden="true" />
          {live ? t('next.kickerLive') : t('next.kicker')}
          <span className="pl-kicker-end">{countdownText(lang, b.startMs, now)}</span>
        </p>
        <p className="pl-when">{whenText(lang, b.startMs, now)}</p>
        <p className="pl-with">
          {t('next.with')} <b>{h.peerName}</b>
          {h.peerLevel && <span className="pl-level">{String(h.peerLevel).slice(0, 2)}</span>}
        </p>
        <div className="pl-actions">
          {h.joinable && (
            <Button icon={<Mic size={18} aria-hidden="true" />} onClick={() => navigate(`/chat/${h.peerUid}`, { state: joinState(b) })}>
              {t('next.join')}
            </Button>
          )}
          <Button variant="secondary" icon={<MessageCircle size={18} aria-hidden="true" />} onClick={() => navigate(`/chat/${h.peerUid}`)}>
            {t('next.message')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/plan')}>{t('next.myWeek')}</Button>
        </div>
        {!h.joinable && <p className="pl-hint">{t('next.joinHint')}</p>}
        {!live && <AddToCalendar booking={b} peerName={h.peerName} />}
        {limitLine}
      </section>
    );
  }

  if (h.kind === 'checkin') return <CheckinCard uid={uid} h={h} onboarding={onboarding} clock={clock} navigate={navigate} limitLine={limitLine} lang={lang} />;
  if (h.kind === 'no_match' && (h.reason === 'no_overlap' || h.reason === 'no_partner_left') && onboarding) {
    return <NoMatchCard uid={uid} h={h} onboarding={onboarding} clock={clock} navigate={navigate} limitLine={limitLine} lang={lang} />;
  }

  // «Message someone you have practised with» only for someone who has —
  // a newcomer's Partners tab is empty, so the line and the button were a
  // dead end on their very first Today (pre-release walk 2026-10-17).
  const sooner = hasPartners ? ` ${t('sooner')}` : '';
  const partnersAction = hasPartners ? { label: t('partners'), onClick: () => navigate('/chats') } : null;
  const lookingDays = Array.isArray(h.dayList) && h.dayList.length ? practiceDayNames(lang, h.dayList) : '';

  const simple = {
    answer: {
      icon: CalendarClock,
      title: t('answer.title', { n: h.count }),
      text: t('answer.text'),
      action: { label: t('answer.action'), onClick: () => navigate('/plan') },
    },
    setup: {
      icon: CalendarDays,
      title: t('setup.title'),
      text: t('setup.text'),
      action: { label: t('setup.action'), onClick: () => navigate('/onboarding', { state: { jumpTo: 'charter', returnTo: '/' } }) },
    },
    paused: {
      icon: PauseCircle,
      title: t('paused.title'),
      text: t('paused.text'),
      action: {
        label: busy ? t('paused.busy') : t('paused.action'),
        onClick: async () => { setBusy(true); await setPlanPaused(uid, false).catch(() => {}); setBusy(false); },
      },
    },
    done: {
      icon: Trophy,
      title: t('done.title'),
      text: t('done.text', { a: h.attended, t: h.target }),
      action: { label: t('done.action'), onClick: () => navigate('/chats') },
    },
    no_match: {
      icon: UsersRound,
      title: t('noMatch.title'),
      // The reason in the learner's language; planState's English text for a
      // reason this table does not know yet.
      text: h.reason && practiceText(lang, `noMatch.${h.reason}`) !== `noMatch.${h.reason}` ? t(`noMatch.${h.reason}`) : h.text,
      action: { label: t('noMatch.action'), onClick: () => navigate('/onboarding', { state: { jumpTo: 'availability', returnTo: '/' } }) },
    },
    looking: {
      icon: Sparkles,
      title: lookingDays ? t('looking.title', { days: lookingDays }) : (h.days ? t('looking.title', { days: h.days }) : t('looking.titleWeek')),
      text: `${t('looking.text')}${sooner}`,
      action: partnersAction,
    },
    waiting: {
      icon: Sparkles,
      title: t('waiting.title'),
      text: `${t('waiting.text')}${sooner}`,
      action: partnersAction,
    },
  }[h.kind] || null;
  // Out of planned practices (only while the packages switch is on): the
  // planner leaves them out (autoRoster `no_practices_left`), so «looking for
  // partners» / «your plan arrives on Sunday» was a promise nobody keeps. The
  // quiet line below still carries «See packages» — no bigger sell than that.
  if (noPractices && (h.kind === 'looking' || h.kind === 'waiting')) {
    Object.assign(simple, {
      title: t('free.title'),
      text: t('free.text'),
      action: null,
    });
  }
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
      {simple.action && (
        <div className="pl-actions">
          <Button
            variant="primary"
            onClick={simple.action.onClick}
            disabled={busy}
          >
            {simple.action.label}
          </Button>
        </div>
      )}
      {limitLine}
    </section>
  );
}

// Autopilot weekend heads-up (utils/myWeek.checkinFor): next week is planned
// on the usual times without a word from the learner (default «in»,
// 2026-10-18). It tells, it does not ask: other hours live on the Plan grid,
// the week off is one tap here (onboarding.weeks.{monday}.skip).
function CheckinCard({ uid, h, onboarding, clock, navigate, limitLine, lang }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const t = (key, vars) => practiceText(lang, key, vars);
  const n = h.target;
  const off = async () => {
    setBusy(true); setErr('');
    try { await saveWeek(uid, onboarding, h.monday, null); } catch { setErr(t('saveError')); }
    setBusy(false);
  };
  return (
    <section id="tour-next" className="pl-card pl-card--hero" style={clock} aria-label="Your practice">
      <HeroParade />
      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        <span className="pl-row-icon" aria-hidden="true"><CalendarDays size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="pl-title">{t('checkin.title')}</p>
          <p className="pl-text">{t('checkin.text', { days: practiceDayNames(lang, h.days), n })}</p>
        </div>
      </div>
      <div className="pl-actions">
        <Button onClick={() => navigate('/plan')}>{t('checkin.change')}</Button>
        <Button variant="ghost" onClick={off} disabled={busy}>{busy ? t('saving') : t('checkin.off')}</Button>
      </div>
      {err && <p className="pl-hint">{err}</p>}
      {limitLine}
    </section>
  );
}

// Nobody fits: offer the busiest time they are not free at yet, in their own
// clock, as one tap (appConfig/popularTimes — counts only, no names).
function NoMatchCard({ uid, h, onboarding, clock, navigate, limitLine, lang }) {
  const t = (key, vars) => practiceText(lang, key, vars);
  const cells = usePopularTimes();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const tip = cells ? popularSuggestion(cells, onboarding.availability, offsetVsBaku(onboarding.timeZone || 'Asia/Baku')) : null;
  const add = async () => {
    setBusy(true);
    try { await addFreeBlock(uid, onboarding, tip); setAdded(true); } catch { /* the button stays */ }
    setBusy(false);
  };
  return (
    <section id="tour-next" className="pl-card pl-card--hero" style={clock} aria-label="Your practice">
      <HeroParade />
      <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        <span className="pl-row-icon" aria-hidden="true"><UsersRound size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="pl-title">{added ? t('noMatch.added') : t('noMatch.title')}</p>
          <p className="pl-text">
            {added ? t('noMatch.addedText', { label: tipLabel(lang, tip) })
              : tip ? t('noMatch.popular', { label: tipLabel(lang, tip) })
                : (h.reason ? t(`noMatch.${h.reason}`) : h.text)}
          </p>
        </div>
      </div>
      <div className="pl-actions">
        {tip && !added && <Button onClick={add} disabled={busy}>{busy ? t('noMatch.adding') : t('noMatch.add', { label: tipLabel(lang, tip) })}</Button>}
        <Button variant={tip && !added ? 'ghost' : 'primary'} onClick={() => navigate('/onboarding', { state: { jumpTo: 'availability', returnTo: '/' } })}>
          {t('noMatch.action')}
        </Button>
      </div>
      {limitLine}
    </section>
  );
}

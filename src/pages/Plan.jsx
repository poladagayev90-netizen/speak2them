import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarDays, CheckCheck, Pencil, UsersRound, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui';
import MatchOfferCard from '../components/MatchOfferCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import NextPracticeCard from '../components/plan/NextPracticeCard';
import ThisWeekCard from '../components/plan/ThisWeekCard';
import BookingRow from '../components/plan/BookingRow';
import MissReasonCard from '../components/plan/MissReason';
import LessonRow from '../components/plan/LessonRow';
import useMyLessons, { useTeachingLessons } from '../hooks/useMyLessons';
import { isAdminUser } from '../constants';
import { lessonItems, teachingItems, mergeSchedule } from '../utils/tutorLessons';
import useMyPlan, { setPlanPaused, useAutoMode } from '../hooks/useMyPlan';
import WeekCalendar from '../components/plan/WeekCalendar';
import { useBillingConfig } from '../hooks/usePackages';
import { outOfPractices, packageView } from '../utils/packages';
import { subscribeToSlotChange } from '../utils/practiceSlots';
import { planHeadline, openOffers, upcomingBookings, bookingDays, weekGoal } from '../utils/planState';
import { respondToOffer } from '../utils/matchOffers';
import { WEEK_DAYS, formatMinutes, cityOf, totalHours } from '../utils/timezone';
import { labelOf, WEEKLY_TARGETS } from '../utils/onboarding';
import { isGuestUser } from '../utils/guest';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { practiceText } from '../data/practiceCopy';
import GuestPromptCard from '../components/GuestPromptCard';
import '../components/plan/plan.css';

// Kinds of Today's card worth repeating here: the ones the week calendar does
// not already say (Polad 2026-10-07: «Your next plan arrives on Sunday» under
// «You're in · Wed, Thu, Fri» was both extra and wrong).
const PLAN_CARD_KINDS = new Set(['setup', 'paused', 'no_match']);

// The Plan tab: the whole week, and the only place it is managed.
//
// Today answers "what now?" with one card; this page holds everything behind
// it — proposals to answer (with "Confirm all", because a Sunday plan brings
// several at once), every booked practice with join / message / change time /
// cancel, the week's progress, and the two things that shape next week's
// plan: your free times and the pause switch. It replaced the Live tab: the
// product no longer asks people to find a partner who happens to be online.
export default function Plan({ user }) {
  if (isGuestUser(user)) {
    return <GuestPromptCard variant="page" section="plan" guideLanguage={user?.guideLanguage} />;
  }
  return <PlanInner user={user} />;
}

function PlanInner({ user }) {
  const { lang } = useFirstRunCopy(user?.guideLanguage);
  const pt = (k, v) => practiceText(lang, k, v);
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const uid = user?.uid;
  const plan = useMyPlan(uid);
  // Packages: a quiet line on the card, only when the switch is on and nothing is left.
  const { config: billing } = useBillingConfig();
  const noPractices = outOfPractices(packageView({ user, summary: plan.planStatus?.access, config: billing }), billing);
  // A partner's pending "change the time?" request.
  const [slotChange, setSlotChange] = useState(null);
  useEffect(() => subscribeToSlotChange(uid, setSlotChange), [uid]);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');

  const autoMode = useAutoMode();
  const headline = planHeadline({ uid, ...plan, autoMode });
  const open = openOffers(plan.offers, uid, plan.now);
  const booked = upcomingBookings(plan.bookings, plan.now);
  const thisWeek = booked.filter((b) => b.weekKey === plan.weekKey);
  // Individual lessons share the schedule with the booked practices.
  const myLessons = useMyLessons(uid);
  const teacherDesk = user?.role === 'teacher' || isAdminUser(user);
  const teaching = useTeachingLessons(uid, teacherDesk);
  const schedule = mergeSchedule(booked, mergeSchedule(
    myLessons.active ? lessonItems(myLessons.lessons, plan.now) : [],
    teachingItems(teaching, plan.now),
  ));
  const ob = plan.onboarding;

  // "Mon–Fri 18:00–22:00 · Sat 11:00–14:00": days with the same hours are
  // grouped, so a normal week fits on one or two lines.
  const freeDays = useMemo(() => {
    const ranges = ob?.availability || [];
    const perDay = WEEK_DAYS.map((d) => ({
      short: practiceText(lang, `wday.${d.day}`),
      text: ranges.filter((r) => r.day === d.day)
        .map((r) => `${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)}`).join(', '),
    }));
    const groups = [];
    for (const d of perDay) {
      const last = groups[groups.length - 1];
      if (d.text && last && last.text === d.text && last.contiguous) { last.to = d.short; }
      else groups.push({ from: d.short, to: d.short, text: d.text, contiguous: !!d.text });
    }
    return groups.filter((g) => g.text).map((g) => `${g.from === g.to ? g.from : `${g.from}–${g.to}`} ${g.text}`);
  }, [ob, lang]);

  const confirmAll = async () => {
    setConfirming(true);
    setMsg('');
    let failed = 0;
    for (const o of open) {
      const res = await respondToOffer(o.id, true);
      if (!res.ok) failed += 1;
    }
    setConfirming(false);
    setMsg(failed ? pt('plan.confirmedPartial', { ok: open.length - failed, fail: failed }) : pt('plan.confirmedAll'));
  };

  const editTimes = () => navigate('/onboarding', { state: { jumpTo: 'availability', returnTo: '/plan' } });

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">{pt('plan.title')}</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '100px' }}>
        <SlotChangeBanner request={slotChange} lang={lang} onDone={() => setSlotChange(null)} />
        <MissReasonCard uid={uid} onboarding={ob} now={plan.now} lang={lang} />

        {/* Questions first: «Needs your answer» used to sit below the week
            grid, out of sight on a phone (Polad 2026-11-10 could not find it). */}
        {open.length > 0 && (
          <div className="pl-section" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-2)' }}>
            <p className="ui-section-label" style={{ margin: 0 }}>{pt('plan.needsAnswer')}</p>
            {open.length > 1 && (
              <Button size="sm" variant="secondary" style={{ marginLeft: 'auto' }} icon={<CheckCheck size={16} aria-hidden="true" />}
                onClick={confirmAll} disabled={confirming}>
                {confirming ? pt('plan.confirming') : pt('plan.confirmAll', { n: open.length })}
              </Button>
            )}
          </div>
        )}
        {/* Outside the section: after "Confirm all" the section is gone, and
            the result still has to be read. */}
        {msg && <p className="pl-notice" role="status">{msg}</p>}
        <MatchOfferCard uid={uid} lang={lang} />

        {/* The week as a calendar: what is booked, and the days you want. */}
        {ob && ob.charterAcceptedAt && (ob.availability || []).length > 0 && (
          <WeekCalendar uid={uid} onboarding={ob} bookings={plan.bookings} offers={plan.offers}
            access={plan.planStatus?.access} verdict={plan.planStatus?.auto} weekKey={plan.weekKey} now={plan.now} lang={lang} />
        )}

        {/* The status card only when there is nothing booked or to answer —
            otherwise the lists below ARE the status. */}
        {/* A teacher (or the admin) is not a learner: no "set up your plan" —
            Today already hides it; here it was the only card a new teacher saw. */}
        {teacherDesk && headline.kind === 'setup' && !schedule.length && !plan.loading && (
          <section className="pl-card" aria-label={pt('plan.teacherTitle')}>
            <p className="pl-title">{pt('plan.teacherTitle')}</p>
            <p className="pl-text">{pt('plan.teacherSub')}</p>
            <div className="pl-actions">
              <Button variant="secondary" onClick={() => navigate(isAdminUser(user) ? '/admin' : '/teacher')}>{pt('plan.openDash')}</Button>
            </div>
          </section>
        )}
        {!booked.length && !open.length && !plan.loading && !(teacherDesk && headline.kind === 'setup') && (PLAN_CARD_KINDS.has(headline.kind) || plan.planStatus?.limit?.active || noPractices) && (
          <NextPracticeCard uid={uid} headline={headline} now={plan.now} limit={plan.planStatus?.limit} noPractices={noPractices} onboarding={ob} hasPartners={(user?.callCount || 0) > 0} lang={lang} />
        )}

        {schedule.length > 0 && (
          <>
            <p className="ui-section-label pl-section">{pt('plan.booked')}</p>
            {/* A schedule, not a list: a day column on the left and a NOW line
                on top, so "how far away is it" reads before the details. */}
            <section className="pl-timeline" aria-label={pt('plan.booked')}>
              <div className="pl-now" aria-hidden="true"><span>{pt('plan.now')}</span></div>
              {bookingDays(schedule, plan.now, lang).map((day) => (
                <div key={day.key} className={`pl-day ${day.isToday ? 'is-today' : ''}`}>
                  <div className="pl-day-col">
                    <span className="pl-day-dow">{day.isToday ? pt('plan.todayCaps') : day.dow}</span>
                    <span className="pl-day-num">{day.date}</span>
                  </div>
                  <div className="pl-day-items">
                    {day.items.map((b) => (b.kind === 'lesson'
                      ? <LessonRow key={b.id} lesson={b} now={plan.now} lang={lang} />
                      : <BookingRow key={b.id} booking={b} uid={uid} now={plan.now} lang={lang} onboarding={ob} autoOpen={navState?.openBooking === b.id ? (navState.openTime ? 'time' : 'more') : null} />))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {Number(ob?.weeklyTarget) > 0 && (
          <ThisWeekCard uid={uid} target={weekGoal({ onboarding: ob, weekKey: plan.weekKey, limitTarget: plan.planStatus?.limit?.active ? plan.planStatus.limit.target : null })} attended={plan.attended} bookings={thisWeek} showList={false} now={plan.now} lang={lang} />
        )}

        {ob && (
          <section className="pl-card" aria-label={pt('plan.builtFrom')}>
            <p className="ui-section-label" style={{ margin: 0 }}>{pt('plan.builtFrom')}</p>
            <div className="pl-rows">
              <button type="button" className="pl-row" onClick={editTimes}>
                <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><CalendarDays size={18} /></span>
                <span className="pl-row-main">
                  <p className="pl-row-title">{pt('plan.freeTimes', { h: totalHours(ob.availability || []) })}</p>
                  <p className="pl-row-sub pl-row-sub--wrap">{freeDays.join(' · ') || pt('plan.noneYet')} {ob.timeZone ? pt('plan.cityTime', { city: cityOf(ob.timeZone) }) : ''}</p>
                  {((ob.maybeAvailability || []).length > 0 || (ob.busyAvailability || []).length > 0) && (
                    <p className="pl-row-sub pl-row-sub--wrap">
                      {[(ob.maybeAvailability || []).length && pt('plan.maybe', { h: totalHours(ob.maybeAvailability) }),
                        (ob.busyAvailability || []).length && pt('plan.never', { h: totalHours(ob.busyAvailability) })].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </span>
                <Pencil size={16} className="pl-row-end" aria-hidden="true" />
              </button>
              <button type="button" className="pl-row" onClick={() => navigate('/onboarding', { state: { jumpTo: 'target', returnTo: '/plan' } })}>
                <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><CheckCheck size={18} /></span>
                <span className="pl-row-main">
                  <p className="pl-row-title">{pt('plan.weeklyTarget', { count: Number(ob.weeklyTarget) || 0, label: labelOf(WEEKLY_TARGETS, ob.weeklyTarget) })}</p>
                  <p className="pl-row-sub">{pt('plan.targetSub')}</p>
                </span>
                <Pencil size={16} className="pl-row-end" aria-hidden="true" />
              </button>
              <button type="button" className="pl-row" onClick={() => navigate('/onboarding', { state: { jumpTo: 'phone', returnTo: '/plan' } })}>
                <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><MessageCircle size={18} /></span>
                <span className="pl-row-main">
                  <p className="pl-row-title">WhatsApp · {ob.whatsapp || pt('plan.waNotAdded')}</p>
                  <p className="pl-row-sub">{pt('plan.waSub')}</p>
                </span>
                <Pencil size={16} className="pl-row-end" aria-hidden="true" />
              </button>
            </div>
            <label className="pl-switch pl-text">
              <input
                type="checkbox"
                checked={ob.planPaused === true}
                onChange={(e) => setPlanPaused(uid, e.target.checked).catch(() => setMsg(pt('saveError')))}
              />
              {pt('plan.pauseLabel')}
            </label>
          </section>
        )}

        {/* Only for someone who has a past partner — a newcomer's Partners tab is empty. */}
        {(user?.callCount || 0) > 0 && <section className="pl-card">
          <button type="button" className="pl-row" onClick={() => navigate('/chats')}>
            <span className="pl-row-icon" aria-hidden="true"><UsersRound size={18} /></span>
            <span className="pl-row-main">
              <p className="pl-row-title">{pt('plan.talkNow')}</p>
              <p className="pl-row-sub">{pt('plan.talkNowSub')}</p>
            </span>
            <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
          </button>
        </section>}
      </div>
    </div>
  );
}

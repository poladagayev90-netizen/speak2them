import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCheck, Pencil, UsersRound, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui';
import MatchOfferCard from '../components/MatchOfferCard';
import SlotChangeBanner from '../components/SlotChangeBanner';
import NextPracticeCard from '../components/plan/NextPracticeCard';
import ThisWeekCard from '../components/plan/ThisWeekCard';
import BookingRow from '../components/plan/BookingRow';
import useMyPlan, { setPlanPaused } from '../hooks/useMyPlan';
import { subscribeToSlotChange } from '../utils/practiceSlots';
import { planHeadline, openOffers, upcomingBookings } from '../utils/planState';
import { respondToOffer } from '../utils/matchOffers';
import { WEEK_DAYS, formatMinutes, cityOf, totalHours } from '../utils/timezone';
import { labelOf, WEEKLY_TARGETS } from '../utils/onboarding';
import '../components/plan/plan.css';

// The Plan tab: the whole week, and the only place it is managed.
//
// Today answers "what now?" with one card; this page holds everything behind
// it — proposals to answer (with "Confirm all", because a Sunday plan brings
// several at once), every booked practice with join / message / change time /
// cancel, the week's progress, and the two things that shape next week's
// plan: your free times and the pause switch. It replaced the Live tab: the
// product no longer asks people to find a partner who happens to be online.
export default function Plan({ user }) {
  const navigate = useNavigate();
  const uid = user?.uid;
  const plan = useMyPlan(uid);
  // A partner's pending "change the time?" request.
  const [slotChange, setSlotChange] = useState(null);
  useEffect(() => subscribeToSlotChange(uid, setSlotChange), [uid]);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');

  const headline = planHeadline({ uid, ...plan });
  const open = openOffers(plan.offers, uid, plan.now);
  const booked = upcomingBookings(plan.bookings, plan.now);
  const thisWeek = booked.filter((b) => b.weekKey === plan.weekKey);
  const ob = plan.onboarding;

  // "Mon–Fri 18:00–22:00 · Sat 11:00–14:00": days with the same hours are
  // grouped, so a normal week fits on one or two lines.
  const freeDays = useMemo(() => {
    const ranges = ob?.availability || [];
    const perDay = WEEK_DAYS.map((d) => ({
      short: d.short,
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
  }, [ob]);

  const confirmAll = async () => {
    setConfirming(true);
    setMsg('');
    let failed = 0;
    for (const o of open) {
      const res = await respondToOffer(o.id, true);
      if (!res.ok) failed += 1;
    }
    setConfirming(false);
    setMsg(failed ? `${open.length - failed} confirmed, ${failed} could not be confirmed.` : 'All confirmed. Each is booked once your partner says yes too.');
  };

  const editTimes = () => navigate('/onboarding', { state: { jumpTo: 'availability', returnTo: '/plan' } });

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo">Your plan</div>
      </div>
      <div className="home-body" style={{ paddingBottom: '100px' }}>
        <SlotChangeBanner request={slotChange} onDone={() => setSlotChange(null)} />

        {/* The status card only when there is nothing booked or to answer —
            otherwise the lists below ARE the status. */}
        {!booked.length && !open.length && !plan.loading && (
          <NextPracticeCard uid={uid} headline={headline} now={plan.now} limit={plan.planStatus?.limit} />
        )}

        {open.length > 0 && (
          <>
            <div className="pl-section" style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginTop: 'var(--s-2)' }}>
              <p className="ui-section-label" style={{ margin: 0 }}>Needs your answer</p>
              {open.length > 1 && (
                <Button size="sm" variant="secondary" style={{ marginLeft: 'auto' }} icon={<CheckCheck size={16} aria-hidden="true" />}
                  onClick={confirmAll} disabled={confirming}>
                  {confirming ? 'Confirming…' : `Confirm all ${open.length}`}
                </Button>
              )}
            </div>
          </>
        )}
        {/* Outside the section: after "Confirm all" the section is gone, and
            the result still has to be read. */}
        {msg && <p className="pl-notice" role="status">{msg}</p>}
        <MatchOfferCard uid={uid} />

        {booked.length > 0 && (
          <>
            <p className="ui-section-label pl-section">Booked</p>
            <section className="pl-card" style={{ paddingTop: 'var(--s-1)', paddingBottom: 'var(--s-1)' }}>
              {booked.map((b) => <BookingRow key={b.id} booking={b} uid={uid} now={plan.now} />)}
            </section>
          </>
        )}

        {Number(ob?.weeklyTarget) > 0 && (
          <ThisWeekCard uid={uid} target={plan.planStatus?.limit?.active ? Math.min(Number(ob.weeklyTarget), Number(plan.planStatus.limit.target) || 1) : Number(ob.weeklyTarget)} attended={plan.attended} bookings={thisWeek} showList={false} now={plan.now} />
        )}

        {ob && (
          <section className="pl-card" aria-label="What your plan is built from">
            <p className="ui-section-label" style={{ margin: 0 }}>Your plan is built from</p>
            <div className="pl-rows">
              <button type="button" className="pl-row" onClick={editTimes}>
                <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><CalendarDays size={18} /></span>
                <span className="pl-row-main">
                  <p className="pl-row-title">Free times · {totalHours(ob.availability || [])} h a week</p>
                  <p className="pl-row-sub pl-row-sub--wrap">{freeDays.join(' · ') || 'None yet'} {ob.timeZone ? `(${cityOf(ob.timeZone)} time)` : ''}</p>
                </span>
                <Pencil size={16} className="pl-row-end" aria-hidden="true" />
              </button>
              <button type="button" className="pl-row" onClick={() => navigate('/onboarding', { state: { jumpTo: 'target', returnTo: '/plan' } })}>
                <span className="pl-row-icon pl-row-icon--plain" aria-hidden="true"><CheckCheck size={18} /></span>
                <span className="pl-row-main">
                  <p className="pl-row-title">{labelOf(WEEKLY_TARGETS, ob.weeklyTarget)} {Number(ob.weeklyTarget) === 1 ? 'practice' : 'practices'} a week</p>
                  <p className="pl-row-sub">The number you said you can keep</p>
                </span>
                <Pencil size={16} className="pl-row-end" aria-hidden="true" />
              </button>
            </div>
            <label className="pl-switch pl-text">
              <input
                type="checkbox"
                checked={ob.planPaused === true}
                onChange={(e) => setPlanPaused(uid, e.target.checked).catch(() => setMsg('Could not save. Check your connection.'))}
              />
              Pause my plan — no new practices until I switch it back
            </label>
          </section>
        )}

        <section className="pl-card">
          <button type="button" className="pl-row" onClick={() => navigate('/chats')}>
            <span className="pl-row-icon" aria-hidden="true"><UsersRound size={18} /></span>
            <span className="pl-row-main">
              <p className="pl-row-title">Want to talk now?</p>
              <p className="pl-row-sub">Message or call a past partner</p>
            </span>
            <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
}

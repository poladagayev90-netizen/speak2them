// "What should I do now?" — the one question the home screen answers.
//
// Pure, so every state the headline card can be in is pinned by a test
// (planState.test.js). The card itself only draws what this returns.
//
// Honesty rules (from the scheduled-practice plan):
//   • no empty card — when there is no booking, say what is happening instead;
//   • never promise a partner: "we are looking" / "none fits these hours",
//     never "we will find you one";
//   • an unanswered proposal is not held against anyone, so it is phrased as
//     a question, not a debt.

import { autoIn, checkinFor, dayNames, MAX_A_WEEK, weekAnswer } from './myWeek';

export const BLOCK_MS = 2 * 60 * 60 * 1000;
export const JOIN_OPENS_MS = 5 * 60 * 1000;

// Proposals still waiting for THIS learner's answer.
export const openOffers = (offers, uid, now = Date.now()) => (offers || []).filter((o) =>
  Number(o.startMs) > now
  && (o.responses || {})[uid] !== 'accepted'
  && !(Number(o.respondBy) && Number(o.respondBy) <= now));

// Bookings whose block has not ended, nearest first.
export const upcomingBookings = (bookings, now = Date.now()) => (bookings || [])
  .filter((b) => b.status === 'confirmed' && Number(b.startMs) + BLOCK_MS > now)
  .sort((a, b) => a.startMs - b.startMs);

export const canJoin = (booking, now = Date.now()) =>
  !!booking && now >= Number(booking.startMs) - JOIN_OPENS_MS && now < Number(booking.startMs) + BLOCK_MS;

export const peerOf = (booking, uid) => {
  const peerUid = (booking.participants || []).find((p) => p !== uid) || null;
  return { peerUid, peerName: (booking.names || {})[peerUid] || 'your partner', peerLevel: (booking.levels || {})[peerUid] || null };
};

const NO_MATCH_TEXT = {
  no_times: 'You have no free times saved for this week. Add a few and the next plan can include you.',
  no_overlap: 'Nobody who fits you is free at the same hours yet. More free times give the plan more to work with.',
  no_partner_left: 'Everyone free at your hours already had a full week. You are first in line for the next plan.',
  replacement_not_found: 'Your partner could not make it, and no other time has turned up this week yet. Your free times stay open for the next one.',
};

// A reliability limit (Phase 5, server-decided in functions/reliability.js):
// the reason and the way back are always shown; the score never is.
export function limitText(limit) {
  if (!limit || !limit.active) return null;
  const missed = Math.max(1, Number(limit.missed) || 1);
  const left = Math.max(1, Number(limit.recoverLeft) || 1);
  const usual = Math.max(1, Number(limit.usualTarget) || 1);
  return {
    title: 'One practice a week for now',
    text: `${missed} confirmed ${missed === 1 ? 'practice was' : 'practices were'} missed in the last 4 weeks. `
      + `Attend your next ${left === 1 ? 'practice' : `${left} practices`} and your plan goes back to ${usual} a week.`,
  };
}

// kind: setup | paused | next | answer | checkin | done | no_match | waiting
// `autoMode`: the autopilot is on (appConfig/planner.rosterMode "auto"), so
// a learner who has not said «in» for the week is asked (myWeek.checkinFor).
// This week's goal: the days they picked for it (one practice a day, at most
// four), else the usual weekly number; under a reliability limit, never more
// than the limit allows.
export function weekGoal({ onboarding, weekKey, limitTarget = null }) {
  const usual = Math.max(0, Number(onboarding?.weeklyTarget) || 0);
  const answer = weekAnswer(onboarding, weekKey);
  const asked = answer && answer.in && answer.days.length ? Math.min(MAX_A_WEEK, answer.days.length) : usual;
  return limitTarget != null ? Math.min(asked, Number(limitTarget) || 1) : asked;
}

export function planHeadline({
  uid, bookings, offers, planStatus, onboarding, attended = 0, weekKey, now = Date.now(), autoMode = false,
}) {
  const ob = onboarding || null;
  const asked = Math.max(0, Number(ob?.weeklyTarget) || 0);
  // Under a limit the week's goal is what the plan can actually give.
  const limited = !!planStatus?.limit?.active;
  const hasTimes = Array.isArray(ob?.availability) && ob.availability.length > 0;
  if (!ob || !hasTimes || !asked || !ob.charterAcceptedAt) return { kind: 'setup' };

  const next = upcomingBookings(bookings, now)[0] || null;
  if (next) return { kind: 'next', booking: next, ...peerOf(next, uid), joinable: canJoin(next, now) };

  const open = openOffers(offers, uid, now);
  if (open.length) return { kind: 'answer', count: open.length };

  if (ob.planPaused === true) return { kind: 'paused' };
  if (autoMode) {
    const c = checkinFor({ onboarding: ob, access: planStatus?.access, auto: planStatus?.auto, now });
    if (c) return { kind: 'checkin', ...c };
  }
  const goal = weekGoal({ onboarding: ob, weekKey, limitTarget: limited ? planStatus.limit.target : null });
  if (attended >= goal) return { kind: 'done', attended, target: goal };

  // planStatus is written when a plan goes out, for the week it covers.
  if (planStatus && planStatus.state === 'no_match' && planStatus.weekKey >= weekKey) {
    return { kind: 'no_match', text: NO_MATCH_TEXT[planStatus.reason] || NO_MATCH_TEXT.no_overlap, reason: planStatus.reason };
  }
  // In for this week on the autopilot: the hourly refill is searching now,
  // not on Sunday (Polad 2026-10-07: the card said «Sunday» under «You're in»).
  const answer = weekAnswer(ob, weekKey);
  const inNow = (answer && answer.in) || (planStatus?.auto && planStatus.auto.week === weekKey && planStatus.auto.in)
    || autoIn({ onboarding: ob, access: planStatus?.access, monday: weekKey });
  if (autoMode && inNow && !(answer && !answer.in)) {
    return { kind: 'looking', days: answer && answer.in ? dayNames(answer.days) : '' };
  }
  return { kind: 'waiting' };
}

// "Today 20:00" / "Tomorrow 18:00" / "Wednesday 20:00", in the VIEWER's own
// clock — a learner in Istanbul reads the hour on their own phone.
export function whenLabel(startMs, now = Date.now()) {
  const d = new Date(Number(startMs));
  const same = (a, b) => a.toDateString() === b.toDateString();
  const day = same(d, new Date(now)) ? 'Today'
    : same(d, new Date(now + 86400000)) ? 'Tomorrow'
      : d.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${day} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

// Bookings grouped by the learner's calendar day, for the Plan timeline
// (a day column and a NOW line, as on a tutor's schedule). Input is already
// the upcoming, sorted list from upcomingBookings().
export function bookingDays(bookings, now = Date.now()) {
  const days = [];
  for (const b of bookings || []) {
    const d = new Date(Number(b.startMs));
    const key = d.toDateString();
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = {
        key,
        dow: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
        date: d.getDate(),
        month: d.toLocaleDateString('en-GB', { month: 'long' }),
        isToday: key === new Date(now).toDateString(),
        items: [],
      };
      days.push(day);
    }
    day.items.push(b);
  }
  return days;
}

// "Tomorrow, 2 Oct · 21:00" — the short line for the Today "Coming up" list.
export function comingUpLabel(startMs, now = Date.now()) {
  const d = new Date(Number(startMs));
  const same = (a, b) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const day = same(d, new Date(now)) ? 'Today'
    : same(d, new Date(now + 86400000)) ? 'Tomorrow'
      : d.toLocaleDateString('en-GB', { weekday: 'long' });
  return `${day}, ${date} · ${time}`;
}

export function countdownLabel(startMs, now = Date.now()) {
  const diff = Number(startMs) - now;
  if (diff <= 0) return 'Now';
  const min = Math.floor(diff / 60000);
  const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); const m = min % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

// The same navigation state the old "Join the call" used (useLiveLobby).
export const joinState = (booking) => ({
  acceptedCall: true, matchedCall: true, callId: booking.callId, slotId: booking.slotId,
});

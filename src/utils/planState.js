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
};

// kind: setup | paused | next | answer | done | no_match | waiting
export function planHeadline({
  uid, bookings, offers, planStatus, onboarding, attended = 0, weekKey, now = Date.now(),
}) {
  const ob = onboarding || null;
  const target = Math.max(0, Number(ob?.weeklyTarget) || 0);
  const hasTimes = Array.isArray(ob?.availability) && ob.availability.length > 0;
  if (!ob || !hasTimes || !target || !ob.charterAcceptedAt) return { kind: 'setup' };

  const next = upcomingBookings(bookings, now)[0] || null;
  if (next) return { kind: 'next', booking: next, ...peerOf(next, uid), joinable: canJoin(next, now) };

  const open = openOffers(offers, uid, now);
  if (open.length) return { kind: 'answer', count: open.length };

  if (ob.planPaused === true) return { kind: 'paused' };
  if (attended >= target) return { kind: 'done', attended, target };

  // planStatus is written when a plan goes out, for the week it covers.
  if (planStatus && planStatus.state === 'no_match' && planStatus.weekKey >= weekKey) {
    return { kind: 'no_match', text: NO_MATCH_TEXT[planStatus.reason] || NO_MATCH_TEXT.no_overlap, reason: planStatus.reason };
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

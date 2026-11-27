// How one side of a closed booking showed up — on time, N min late, or not
// at all. Pure; the server writes `booking.arrival` and `booking.outcome` at
// the close of the block (functions/arrivals.js, docs/domain/booking.md).
//
// `source` says how far to trust the minute: "server" = the first voice
// token, by the server clock; "client" / "backfill" = the app's own arrival
// note, which a rejoin overwrites — shown as approximate.

// = ON_TIME_GRACE_MIN in functions/arrivals.js.
export const ON_TIME_GRACE_MIN = 2;

const CAME = new Set(['attended', 'arrived', 'partner_no_show']);

export function arrivalStatus(booking, uid) {
  const outcome = booking?.outcome?.[uid] || null;
  const arrival = booking?.arrival?.[uid];
  const partnerMissed = outcome === 'partner_no_show';
  if (arrival && typeof arrival === 'object') {
    const lateMin = Math.max(0, Number(arrival.lateMin) || 0);
    return {
      kind: lateMin <= ON_TIME_GRACE_MIN ? 'on_time' : 'late',
      lateMin,
      approx: arrival.source !== 'server',
      partnerMissed,
    };
  }
  if (arrival === null || outcome === 'no_show') return { kind: 'no_show', lateMin: null, approx: false, partnerMissed };
  if (CAME.has(outcome)) return { kind: 'came', lateMin: null, approx: false, partnerMissed };
  return { kind: 'unknown', lateMin: null, approx: false, partnerMissed };
}

export function arrivalLabel(st) {
  if (st.kind === 'on_time') return 'On time';
  if (st.kind === 'late') return `${st.approx ? '~' : ''}${st.lateMin} min late`;
  if (st.kind === 'no_show') return 'Did not come';
  if (st.kind === 'came') return 'Came · time not recorded';
  return 'No record';
}

// Late arrivals per learner over a set of closed bookings.
export function lateCounts(bookings) {
  const m = new Map();
  for (const b of bookings || []) {
    for (const uid of b.participants || []) {
      if (arrivalStatus(b, uid).kind === 'late') m.set(uid, (m.get(uid) || 0) + 1);
    }
  }
  return m;
}

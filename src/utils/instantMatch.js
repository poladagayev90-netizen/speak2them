// Client wrapper for the synchronous first-match endpoint (matchNewcomerNow).
// Returns the booked call directly so FirstMatchReveal never waits for
// users.upcomingCall (syncUpcomingCall trigger).
import { authedFetch } from '../api';
import { FUNCTIONS_BASE } from '../constants';

export async function requestInstantMatch({ action = 'auto', slotId = null, hostUid = null } = {}) {
  try {
    const res = await authedFetch(`${FUNCTIONS_BASE}/matchNewcomerNow`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        ...(slotId ? { slotId } : {}),
        ...(hostUid ? { hostUid } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'failed' };
    }
    return { ok: true, ...data };
  } catch (e) {
    console.warn('[instantMatch] request failed:', e?.message || e);
    return { ok: false, error: 'network' };
  }
}

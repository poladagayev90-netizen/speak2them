// The warm-up call on the client: whether Today offers it, and the two
// server calls. The server decides again (functions/warmupCall.js —
// warmupEligibility); this only keeps the card off screens where the answer
// would be no. Keep MAX_ATTEMPTS in step with the server.

import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';

export const WARMUP_MAX_ATTEMPTS = 2;

// `config` = appConfig/warmupCall (null while loading or missing = on),
// `record` = warmupCalls/{uid} (null = never tried).
// `admin` = the server's isAdminToken: admins test the warm-up as often as
// they like (Polad 2026-11-07), so only the kill switch hides it from them.
export function showWarmupCard({ user, record, config, loading = false, admin = false }) {
  if (loading || !user) return false;
  if (config && config.enabled === false) return false;
  if (admin) return true;
  if (user.role === 'teacher') return false;
  // A real call already happened: the warm-up's job is done.
  if (Number(user.callCount) > 0) return false;
  if (record && record.completedAt) return false;
  if (record && (Number(record.attempts) || 0) >= WARMUP_MAX_ATTEMPTS) return false;
  return true;
}

async function post(path, body) {
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw Object.assign(new Error(data.error || `http-${res.status}`), { status: res.status, reason: data.reason || data.error });
  return data;
}

// → { token, model, sessionId, maxSeconds, wrapAtSeconds }
export const startWarmup = () => post('warmupCallStart');

// → { completed, best: { quote, note } | null, seconds }
export const endWarmup = ({ sessionId, lines, usage, reason }) => post('warmupCallEnd', { sessionId, lines, usage, reason });

// The warm-up call on the client: whether Today offers it, and the two
// server calls. The server decides again (functions/warmupCall.js —
// warmupEligibility); this only keeps the card off screens where the answer
// would be no. Keep MAX_ATTEMPTS in step with the server.

import { auth } from '../firebase';
import { FUNCTIONS_BASE } from '../constants';

export const WARMUP_MAX_ATTEMPTS = 2;

// WHERE the warm-up is offered (Polad 2026-11-08: «dikilib qalmasın» — it
// must not sit on top of Today for good):
//   'card'  — the big card on top of Today. Only a newcomer who has neither
//             finished it nor put it aside;
//   'panel' — one row in Today's «Get ready» (AInur's corner) after they put it
//             aside with «Not now» or «Go straight to my partners»
//             (`users.warmupDismissedAt`), while the server would still let
//             them start one;
//   null    — nowhere.
// The two places never show together. The newcomer boundary is the FIRST REAL
// CALL (`callCount > 0`): the warm-up is a bridge to that call, so once it
// happened there is nothing left to bridge — the server refuses then too.
// `config` = appConfig/warmupCall (null while loading or missing = on),
// `record` = warmupCalls/{uid} (null = never tried).
// `admin` = the server's isAdminToken: admins test the warm-up as often as
// they like (Polad 2026-11-07) — after «Not now» it stays in the panel for them.
export function warmupOffer({ user, record, config, loading = false, admin = false }) {
  if (loading || !user) return null;
  if (config && config.enabled === false) return null;
  const dismissed = !!user.warmupDismissedAt;
  if (admin) return dismissed ? 'panel' : 'card';
  if (user.role === 'teacher') return null;
  if (Number(user.callCount) > 0) return null;
  if (record && record.completedAt) return null;
  if (record && (Number(record.attempts) || 0) >= WARMUP_MAX_ATTEMPTS) return null;
  return dismissed ? 'panel' : 'card';
}

// AInur on a Plum lavender ground. The original asset's peach fill is baked
// into the picture and clashed with the call screen (Polad 2026-11-07).
export const WARMUP_AVATAR = '/ainur_plum.png';

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
// `lang` = the language this page is showing: AInur greets in it first.
export const startWarmup = ({ lang } = {}) => post('warmupCallStart', { lang });

// → { completed, best: { quote, note } | null, seconds }
// `detail` = why it failed as the browser saw it (socket close code/reason).
export const endWarmup = ({ sessionId, lines, usage, reason, detail }) => post('warmupCallEnd', { sessionId, lines, usage, reason, detail });

const { Timestamp } = require('firebase-admin/firestore');
const { trustedCallSeconds, callStartMs } = require('./practiceStats');

// ── Call log (2026-10-07) ────────────────────────────────────────
// callLog/{callId}_{start}: one line per finished call with BOTH people in it —
// the admin's «who practised with whom, and when» (Admin → Activity). Polad
// asked to see the app's activity, not each analysis, so it holds times and
// names only: no transcript, no scores. Server-written, admin-read (rules).
//
// users/{uid}/practiceSessions already had the times, but per person and
// without the partner, and the calls/{id} doc is per PAIR and overwritten by
// the next call, so neither could answer "who talked yesterday".

const msOf = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : Number(t) || 0);

// What kind of call it was, in words the admin reads. A booking's source
// travels on the call doc (bookings.planCallDocTx); a direct call has none.
const KIND = {
  weekly_plan: 'plan', refill: 'plan', admin_offer: 'admin', slot_match: 'board',
  slot_change: 'board', teacher_match: 'teacher', session_match: 'board',
};
const kindOf = (source) => KIND[source] || 'direct';

// Pure: the document for one call, or null when there is nothing worth a line
// (no start/end, or a few seconds of ringing).
function callLogDoc({ callId, call, participants, names = {}, joined = true }) {
  const start = callStartMs(call);
  const end = msOf(call.endedAt);
  const seconds = trustedCallSeconds(call);
  const uids = [...new Set((participants || []).filter(Boolean))].sort();
  if (!callId || !start || !end || !(seconds > 5) || uids.length !== 2) return null;
  return {
    id: `${callId}_${start}`,
    data: {
      callId,
      participants: uids,
      names: Object.fromEntries(uids.map((u) => [u, String(names[u] || '').slice(0, 80)])),
      startedAt: Timestamp.fromMillis(start),
      endedAt: Timestamp.fromMillis(end),
      seconds,
      kind: kindOf(call.source),
      // Both voices were in the channel; a call one side never joined is
      // still a line (someone tried), and the admin sees it as such.
      joined: !!joined,
    },
  };
}

// Exactly once per call: create() fails if the line exists (a retried trigger).
async function writeCallLog(db, { callId, call, participants, joined }) {
  const names = {};
  await Promise.all((participants || []).map(async (uid) => {
    const snap = await db.doc(`users/${uid}`).get().catch(() => null);
    names[uid] = snap && snap.exists ? (snap.get('name') || '') : '';
  }));
  const line = callLogDoc({ callId, call, participants, names, joined });
  if (!line) return false;
  try {
    await db.doc(`callLog/${line.id}`).create(line.data);
    return true;
  } catch (e) {
    if (e && (e.code === 6 || /already exists/i.test(String(e.message)))) return false;
    throw e;
  }
}

module.exports = { callLogDoc, writeCallLog, kindOf };

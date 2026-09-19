const { Timestamp } = require('firebase-admin/firestore');

const msOf = value => value?.toMillis?.() || (typeof value === 'string' ? Date.parse(value) : 0) || 0;
function weekKey(ms = Date.now()) {
  const d = new Date(ms + 4 * 3600000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// A practice counts from two minutes of real conversation — the same bar
// consumeTrialMinutes uses for a completed session (SESSION_MIN_SECONDS).
const ATTENDED_MIN_SECONDS = 120;

// One attendance event. outcome: attended | no_show | late_cancel | cancelled
// | partner_no_show | unmatched. The last two are the PLATFORM failing the
// learner and must never count against them.
function attendanceDoc(uid, outcome, atMs, extra = {}) {
  return {
    uid, outcome,
    at: Timestamp.fromMillis(atMs), atMs,
    weekKey: weekKey(atMs),
    ...extra,
  };
}

function summarizeAiPractice(analyses, now = Date.now()) {
  const week = weekKey(now);
  let seconds = 0, weeklySeconds = 0, sessions = 0, lastAt = 0;
  for (const a of analyses) {
    if (a.source !== 'ainur' || a.status !== 'done') continue;
    const duration = Number(a.durationSeconds);
    const at = msOf(a.timestamp);
    if (!Number.isFinite(duration) || duration <= 0 || !at) continue;
    seconds += duration;
    sessions++;
    lastAt = Math.max(lastAt, at);
    if (weekKey(at) === week) weeklySeconds += duration;
  }
  return { aiPracticeSeconds: seconds, aiPracticeSessions: sessions, aiPracticeWeek: week, aiPracticeWeekSeconds: weeklySeconds, lastAt };
}

// Rebuild from completed reports, inside one transaction. Retried or out-of-order
// triggers cannot double-credit a session; this also supports the historical repair.
async function syncAiPractice(db, uid) {
  return db.runTransaction(async tx => {
    const userRef = db.doc(`users/${uid}`);
    const user = await tx.get(userRef);
    if (!user.exists) return;
    const reports = await tx.get(db.collection('callAnalysis').where('userId', '==', uid));
    const summary = summarizeAiPractice(reports.docs.map(d => d.data()));
    const { lastAt, ...counters } = summary;
    const teacherId = user.data().teacherId;
    const rosterRef = teacherId ? db.doc(`teachers/${teacherId}/roster/${uid}`) : null;
    const roster = rosterRef ? await tx.get(rosterRef) : null;
    tx.set(userRef, {
      ...counters,
      ...(lastAt > msOf(user.data().lastPracticeAt) ? { lastPracticeAt: Timestamp.fromMillis(lastAt) } : {}),
    }, { merge: true });
    if (rosterRef && lastAt > msOf(roster.data()?.lastActiveAt)) {
      tx.set(rosterRef, { lastActiveAt: Timestamp.fromMillis(lastAt) }, { merge: true });
    }
    return counters;
  });
}

// Keep a distinct immutable record even though legacy clients reuse a call ID.
// The trigger snapshot, rather than a later read of that reused document, is the source.
async function recordCallPractice(db, callId, call, uid) {
  const start = msOf(call.matchedAt) || msOf(call.createdAt);
  const end = msOf(call.endedAt);
  if (!start || !end || !(call.authoritativeDurationSec > 5)) return;
  return db.runTransaction(async tx => {
    const userRef = db.doc(`users/${uid}`);
    const user = await tx.get(userRef);
    if (!user.exists) return;
    const record = userRef.collection('practiceSessions').doc(`${callId}_${start}`);
    const previous = await tx.get(record);
    if (previous.exists) return;
    const teacherId = user.data().teacherId;
    const rosterRef = teacherId ? db.doc(`teachers/${teacherId}/roster/${uid}`) : null;
    const roster = rosterRef ? await tx.get(rosterRef) : null;
    tx.set(record, { source: 'call', callId, startedAt: Timestamp.fromMillis(start), endedAt: Timestamp.fromMillis(end), durationSeconds: call.authoritativeDurationSec });
    // Attendance ledger (Phase 4): a real conversation of at least two minutes
    // is a practice the learner showed up for, whichever way it was arranged.
    // Written in the same transaction as the practiceSessions record, so it is
    // exactly-once for the same reason that record is.
    if (call.authoritativeDurationSec >= ATTENDED_MIN_SECONDS) {
      tx.set(db.doc(`attendance/${callId}_${start}_${uid}`), attendanceDoc(uid, 'attended', start, {
        source: call.source || 'direct', slotId: call.slotId || null, callId,
        durationSeconds: call.authoritativeDurationSec,
      }));
    }
    if (end > msOf(user.data().lastPracticeAt)) tx.set(userRef, { lastPracticeAt: Timestamp.fromMillis(end) }, { merge: true });
    if (rosterRef && end > msOf(roster.data()?.lastActiveAt)) tx.set(rosterRef, { lastActiveAt: Timestamp.fromMillis(end) }, { merge: true });
  });
}

module.exports = { summarizeAiPractice, syncAiPractice, recordCallPractice, weekKey, attendanceDoc, ATTENDED_MIN_SECONDS };

// One-off: add sessionDays / bonusDays to appConfig/session (merge, so the
// existing session TIMES and bufferMinutes are preserved). Weekday convention:
// 0=Sunday … 6=Saturday. These drive advanceCycle: the global topic cycle only
// steps forward on these days. Admin can edit them later without a code change.
//
// Run with a logged-in Firebase CLI / gcloud ADC:
//   node scripts/set-session-days.js
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'speak2them-64f2b' });

const SESSION_DAYS = [1, 3, 5]; // Mon / Wed / Fri — 3 sessions per week
const BONUS_DAYS = [6];         // Sat — bonus day

(async () => {
  const ref = admin.firestore().collection('appConfig').doc('session');
  await ref.set(
    { sessionDays: SESSION_DAYS, bonusDays: BONUS_DAYS },
    { merge: true }
  );
  const snap = await ref.get();
  console.log('appConfig/session is now:', JSON.stringify(snap.data(), null, 2));
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

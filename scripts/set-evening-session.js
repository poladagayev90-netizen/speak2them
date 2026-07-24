// One-off: switch appConfig/session to the single 21:00 evening session and
// turn the schedule on. The Firestore doc's `sessions` array WINS over the code
// defaults in src/utils/sessionSchedule.js and functions/index.js, so shipping
// the code change alone is not enough — this doc must be updated too, otherwise
// a leftover 16:00 entry keeps sending reminders and matching.
//
// Weekday convention: 0=Sunday … 6=Saturday. Sunday is 0, NOT 7 — a literal 7
// would never match bakuWeekday and Sunday would silently disappear.
// sessionDays/bonusDays only mark the MAIN days (crowd + topic cycle advance);
// they do not restrict practice. 21:00 is shown as the recommended hour daily.
//
// Run with a logged-in Firebase CLI / gcloud ADC:
//   node scripts/set-evening-session.js
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'speak2them-64f2b' });

const SESSIONS = [{ hour: 21, minute: 0 }]; // yalnız axşam — 16:00 ləğv edildi
const SESSION_DAYS = [1, 3, 5]; // Mon / Wed / Fri
const BONUS_DAYS = [0];         // Sun

(async () => {
  const ref = admin.firestore().collection('appConfig').doc('session');
  const before = await ref.get();
  console.log('BEFORE:', JSON.stringify(before.data() || null, null, 2));

  await ref.set(
    {
      enabled: true,
      sessions: SESSIONS,
      sessionDays: SESSION_DAYS,
      bonusDays: BONUS_DAYS,
    },
    { merge: true }
  );

  const after = await ref.get();
  console.log('AFTER:', JSON.stringify(after.data(), null, 2));
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

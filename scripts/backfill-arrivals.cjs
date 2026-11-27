// One-off (2026-11-27): `arrival` for planned calls closed before the server
// started recording first arrivals (functions/arrivals.js, docs/domain/booking.md).
//
// Reads only: bookings (status "done", no `arrival` yet), the pair's
// practiceSlots member docs (`arrivedAt`, the app's note) and agoraJoins (the
// pair's LAST voice token, server clock). Writes only: bookings/{id}.arrival,
// merged — nothing else is changed, nothing is deleted.
//
// Both sources are "last join" (a rejoin overwrites them), so the earliest of
// the two inside the block is taken and marked source "backfill": the admin
// sees it as approximate ("~"). Outside the block = no time; a side whose
// outcome is no_show = null (did not come).
//
// Dry-run by default; --apply writes.
//   Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/backfill-arrivals.cjs [--apply]
//   Production: node scripts/backfill-arrivals.cjs [--apply]   (firebase-tools CLI login, like
//               backfillTeacherAnalyses.cjs)
const path = require('path');
const fs = require('fs');
const arrivals = require('../functions/arrivals');

const apply = process.argv.includes('--apply');
const PROJECT = 'speak2them-64f2b';

async function openDb() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const admin = require('../functions/node_modules/firebase-admin');
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || PROJECT });
    return admin.firestore();
  }
  const { firestoreRest } = require('./firestore-rest.cjs');
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config/configstore/firebase-tools.json'), 'utf8'));
  const cli = require(path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/auth.js'));
  const token = await cli.getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  return firestoreRest(token.access_token, PROJECT);
}

// The earliest in-block time among the "last join" notes, or null.
function backfillArrival(times, startMs, endMs) {
  const inBlock = times.map(arrivals.msOf).filter((t) => arrivals.inArrivalWindow(t, startMs, endMs));
  if (!inBlock.length) return null;
  const atMs = Math.min(...inBlock);
  return { atMs, lateMin: arrivals.lateMinutes(atMs, startMs), source: 'backfill' };
}

async function main() {
  const db = await openDb();
  const snap = await db.collection('bookings').where('status', '==', 'done').get();
  let todo = 0; let written = 0;
  for (const d of snap.docs) {
    const b = d.data() || {};
    if (b.arrival && typeof b.arrival === 'object') continue;
    const people = (b.participants || []).filter(Boolean);
    if (people.length !== 2 || !b.slotId || !b.startMs) continue;
    const endMs = b.endMs || b.startMs + 2 * 3600000;
    const pairKey = [...people].sort().join('_');
    const arrival = {};
    for (const uid of people) {
      const [member, join] = await Promise.all([
        db.collection('practiceSlots').doc(b.slotId).collection('members').doc(uid).get(),
        db.collection('agoraJoins').doc(`${pairKey}_${uid}`).get(),
      ]);
      arrival[uid] = backfillArrival([
        member.exists ? (member.data() || {}).arrivedAt : null,
        join.exists ? (join.data() || {}).at : null,
      ], b.startMs, endMs);
    }
    const map = arrivals.bookingArrivalMap(people, arrival, b.outcome || {});
    todo += 1;
    const line = people.map((u) => {
      const a = map[u];
      return `${(b.names || {})[u] || u.slice(0, 6)}: ${a ? `${a.lateMin} min` : (a === null ? 'did not come' : 'no time')}`;
    }).join(' · ');
    console.log(`${d.id}  ${line}`);
    if (apply) {
      await db.runTransaction(async (tx) => {
        tx.set(db.collection('bookings').doc(d.id), { arrival: map }, { merge: true });
      });
      written += 1;
    }
  }
  console.log(`\n${todo} closed bookings without arrival${apply ? `, ${written} written` : ' (dry run — add --apply to write)'}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { backfillArrival };

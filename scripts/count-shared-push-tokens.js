// READ-ONLY: counts push tokens that sit under more than one account.
//
// A device that switched accounts kept its token doc under the old uid (sign-out
// never deleted it before 2026-11-18), so the old account's pushes still reach
// that device. What it counts: the same token value under several uids.
// What it cannot see: an APK on account A and Chrome on account B on one phone
// (Polad's case) — those are two different token values, so nothing links them
// server-side; only the sign-out fix stops that one.
// Prints counts and anonymised uid prefixes only — no tokens, names or emails.
// Deletes nothing; the cleanup is a later phase.
//
// Run with a logged-in Firebase CLI / gcloud ADC:
//   node scripts/count-shared-push-tokens.js
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'speak2them-64f2b' });

(async () => {
  const snap = await admin.firestore().collectionGroup('fcmTokens').get();
  const uidsByToken = new Map();
  const tokensByUid = new Map();
  snap.forEach((d) => {
    const t = d.data().token;
    if (typeof t !== 'string' || !t.trim()) return;
    const uid = d.ref.parent.parent.id;
    if (!uidsByToken.has(t)) uidsByToken.set(t, new Map());
    uidsByToken.get(t).set(uid, {
      platform: d.data().platform || 'web',
      updatedAt: d.data().updatedAt?.toDate?.() || null,
    });
    tokensByUid.set(uid, (tokensByUid.get(uid) || 0) + 1);
  });

  const shared = [...uidsByToken.values()].filter((m) => m.size > 1);
  const affectedUids = new Set(shared.flatMap((m) => [...m.keys()]));
  const byPlatform = {};
  for (const m of shared) {
    const p = [...m.values()][0].platform;
    byPlatform[p] = (byPlatform[p] || 0) + 1;
  }

  console.log(JSON.stringify({
    tokenDocs: snap.size,
    distinctTokens: uidsByToken.size,
    usersWithTokens: tokensByUid.size,
    tokensSharedAcrossAccounts: shared.length,
    accountsInvolved: affectedUids.size,
    sharedByPlatform: byPlatform,
    usersWith3PlusTokens: [...tokensByUid.values()].filter((n) => n >= 3).length,
  }, null, 2));

  // Per shared token: which account wrote it last (that is the one the device
  // is on now; the others are stale). uid prefixes only.
  shared.slice(0, 20).forEach((m, i) => {
    const rows = [...m.entries()]
      .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
      .map(([uid, v], j) => `${uid.slice(0, 6)}… ${v.platform} ${v.updatedAt ? v.updatedAt.toISOString().slice(0, 10) : '?'}${j === 0 ? ' (current)' : ' (stale)'}`);
    console.log(`#${i + 1}: ${rows.join(' | ')}`);
  });
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

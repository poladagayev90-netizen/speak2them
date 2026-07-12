const admin = require("firebase-admin");

// FCM caps sendEachForMulticast at 500 tokens per call.
const MULTICAST_BATCH = 500;

// Multi-device push tokens.
//
// Each device stores its own token under users/{uid}/fcmTokens/{tokenId} so a
// second device never overwrites the first (the old model kept a single
// users/{uid}.fcmToken field, so only the most recently opened device could
// receive pushes). During the migration we still honour that legacy field for
// users who have not re-opened the app since the change; the two sources are
// unioned and de-duplicated by token value.
//
// A "token entry" is: { token, uid, tokenRef, userRef }
//   tokenRef — the fcmTokens sub-doc to prune when the token dies
//              (null when the value only exists in the legacy field)
//   userRef  — the parent user doc (used to clear the legacy field)

function isDeadTokenError(error) {
  const code = error && error.code;
  return code === "messaging/invalid-registration-token" ||
    code === "messaging/registration-token-not-registered";
}

// All device tokens for one user (sub-collection + legacy field), de-duplicated.
async function getTokensForUser(db, uid, legacyToken) {
  const userRef = db.collection("users").doc(uid);
  const byToken = new Map();
  const snap = await userRef.collection("fcmTokens").get();
  snap.forEach((d) => {
    const t = d.data().token;
    if (typeof t === "string" && t.trim()) {
      byToken.set(t, { token: t, uid, tokenRef: d.ref, userRef });
    }
  });
  if (typeof legacyToken === "string" && legacyToken.trim() && !byToken.has(legacyToken)) {
    byToken.set(legacyToken, { token: legacyToken, uid, tokenRef: null, userRef });
  }
  return [...byToken.values()];
}

// Every device token across the whole user base, for broadcasts. A single
// collection-group read fetches all sub-collection tokens; the legacy field
// (carried on the already-loaded user docs) is merged in for un-migrated users.
// `usersWithLegacy` items: { ref, fcmToken }.
async function getAllTokens(db, usersWithLegacy) {
  const byToken = new Map();
  const groupSnap = await db.collectionGroup("fcmTokens").get();
  groupSnap.forEach((d) => {
    const t = d.data().token;
    if (typeof t !== "string" || !t.trim()) return;
    const userRef = d.ref.parent.parent;
    byToken.set(t, { token: t, uid: userRef.id, tokenRef: d.ref, userRef });
  });
  for (const u of usersWithLegacy) {
    const t = u.fcmToken;
    if (typeof t === "string" && t.trim() && !byToken.has(t)) {
      byToken.set(t, { token: t, uid: u.ref.id, tokenRef: null, userRef: u.ref });
    }
  }
  return [...byToken.values()];
}

// Sends one data-only payload to a list of token entries, batching to FCM's
// 500-per-call limit (sendEachForMulticast already fans out in parallel within
// a batch). Returns counts plus the entries FCM flagged as permanently dead so
// the caller can prune them.
async function sendDataToTokens(entries, data) {
  let sent = 0;
  let failed = 0;
  const dead = [];
  for (let i = 0; i < entries.length; i += MULTICAST_BATCH) {
    const batch = entries.slice(i, i + MULTICAST_BATCH);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch.map((e) => e.token),
      data,
    });
    sent += response.successCount;
    failed += response.failureCount;
    response.responses.forEach((r, idx) => {
      if (isDeadTokenError(r.error)) dead.push(batch[idx]);
    });
  }
  return { sent, failed, dead };
}

// Removes tokens FCM reported as permanently dead: the sub-collection doc, or
// the legacy field when the token only lived there.
async function pruneDeadTokens(dead) {
  await Promise.all(dead.map((e) => {
    if (e.tokenRef) return e.tokenRef.delete().catch(() => null);
    return e.userRef.update({
      fcmToken: admin.firestore.FieldValue.delete(),
    }).catch(() => null);
  }));
}

module.exports = {
  getTokensForUser,
  getAllTokens,
  sendDataToTokens,
  pruneDeadTokens,
  isDeadTokenError,
};

const admin = require("firebase-admin");

// FCM caps sendEachForMulticast at 500 tokens per call.
const MULTICAST_BATCH = 500;

// A token is deleted only after this many *consecutive* dead reports. Each send
// is already retried once before it counts, so a transient/false "not
// registered" no longer evicts a perfectly good token — only one that keeps
// failing is pruned. A successful send resets the counter.
const FAILURE_LIMIT = 3;

// Multi-device push tokens.
//
// Each device stores its own token under users/{uid}/fcmTokens/{tokenId} so a
// second device never overwrites the first (the old model kept a single
// users/{uid}.fcmToken field, so only the most recently opened device could
// receive pushes). During the migration we still honour that legacy field for
// users who have not re-opened the app since the change; the two sources are
// unioned and de-duplicated by token value.
//
// A "token entry" is: { token, uid, tokenRef, userRef, failCount, platform }
//   tokenRef  — the fcmTokens sub-doc (null when the value only exists in the
//               legacy field); carries its own `failCount`
//   userRef   — the parent user doc; the legacy field's failure count lives
//               here as `fcmTokenFailCount`
//   failCount — consecutive dead reports so far for this token
//   platform  — 'web' | 'android'; decides the payload shape (see buildMessage).
//               Tokens written before this field existed are web tokens.

function isDeadTokenError(error) {
  const code = error && error.code;
  return code === "messaging/invalid-registration-token" ||
    code === "messaging/registration-token-not-registered";
}

// All device tokens for one user (sub-collection + legacy field), de-duplicated.
async function getTokensForUser(db, uid, legacyToken, legacyFailCount) {
  const userRef = db.collection("users").doc(uid);
  const byToken = new Map();
  const snap = await userRef.collection("fcmTokens").get();
  snap.forEach((d) => {
    const t = d.data().token;
    if (typeof t === "string" && t.trim()) {
      byToken.set(t, {
        token: t, uid, tokenRef: d.ref, userRef,
        failCount: d.data().failCount || 0,
        platform: d.data().platform || "web",
      });
    }
  });
  if (typeof legacyToken === "string" && legacyToken.trim() && !byToken.has(legacyToken)) {
    byToken.set(legacyToken, {
      token: legacyToken, uid, tokenRef: null, userRef,
      failCount: legacyFailCount || 0, platform: "web",
    });
  }
  return [...byToken.values()];
}

// Every device token across the whole user base, for broadcasts. A single
// collection-group read fetches all sub-collection tokens; the legacy field
// (carried on the already-loaded user docs) is merged in for un-migrated users.
// `usersWithLegacy` items: { ref, fcmToken, fcmTokenFailCount }.
async function getAllTokens(db, usersWithLegacy) {
  const byToken = new Map();
  const groupSnap = await db.collectionGroup("fcmTokens").get();
  groupSnap.forEach((d) => {
    const t = d.data().token;
    if (typeof t !== "string" || !t.trim()) return;
    const userRef = d.ref.parent.parent;
    byToken.set(t, {
      token: t, uid: userRef.id, tokenRef: d.ref, userRef,
      failCount: d.data().failCount || 0,
      platform: d.data().platform || "web",
    });
  });
  for (const u of usersWithLegacy) {
    const t = u.fcmToken;
    if (typeof t === "string" && t.trim() && !byToken.has(t)) {
      byToken.set(t, {
        token: t, uid: u.ref.id, tokenRef: null, userRef: u.ref,
        failCount: u.fcmTokenFailCount || 0, platform: "web",
      });
    }
  }
  return [...byToken.values()];
}

// The payload has to differ per platform.
//
// Web: data-only on purpose. firebase-messaging-sw.js displays it from
// onBackgroundMessage; adding an FCM `notification` block would make the
// browser auto-display it *as well*, so the user sees the push twice.
//
// Android (native APK): a data-only message is delivered silently — the system
// tray shows nothing while the app is backgrounded, which is exactly the case
// that matters. It needs a real `notification` block for Android to render it.
// `data` is still attached so the tap handler keeps its `url` deep link.
function buildMessage(platform, tokens, data) {
  // Web stays data-only (the SW displays it — a notification block would make
  // the browser show it a second time). But without an explicit Urgency the
  // Web Push spec treats the message as "normal", which Chrome may defer while
  // the browser is backgrounded and only deliver when it next wakes — i.e. when
  // the user opens the app. Urgency:high delivers promptly even while dozing;
  // TTL caps how long FCM holds an undelivered one so stale reminders expire.
  if (platform !== "android") {
    return { tokens, data, webpush: { headers: { Urgency: "high", TTL: "3600" } } };
  }
  return {
    tokens,
    data,
    notification: {
      title: data.title || "SpeakLab",
      body: data.body || "",
    },
    android: {
      priority: "high",
      // icon = alpha-only tray silhouette (drawable/ic_stat_speaklab);
      // explicit here as well as in the manifest meta-data so the brand mark
      // shows regardless of which default the device honours.
      notification: { sound: "default", icon: "ic_stat_speaklab", color: "#6C3EF4" },
    },
  };
}

// One multicast pass, batched to FCM's 500-per-call limit (each batch already
// fans out in parallel) and grouped by platform so each group gets the payload
// shape it needs. Partitions the entries by outcome so the caller can retry and
// reconcile.
async function multicastOnce(entries, data) {
  let sent = 0;
  let failed = 0;
  const ok = [];
  const dead = [];

  const byPlatform = new Map();
  for (const e of entries) {
    const platform = e.platform === "android" ? "android" : "web";
    if (!byPlatform.has(platform)) byPlatform.set(platform, []);
    byPlatform.get(platform).push(e);
  }

  for (const [platform, group] of byPlatform) {
    for (let i = 0; i < group.length; i += MULTICAST_BATCH) {
      const batch = group.slice(i, i + MULTICAST_BATCH);
      const response = await admin.messaging().sendEachForMulticast(
        buildMessage(platform, batch.map((e) => e.token), data)
      );
      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((r, idx) => {
        if (r.success) ok.push(batch[idx]);
        else if (isDeadTokenError(r.error)) dead.push(batch[idx]);
        // Other (transient) errors — internal/unavailable/quota — are about the
        // service, not the token: leave the token untouched, don't count it.
      });
    }
  }
  return { sent, failed, ok, dead };
}

// Persists the failure bookkeeping: reset the counter for tokens that just
// succeeded (only if it had climbed), bump it for tokens still reported dead,
// and delete a token once it hits FAILURE_LIMIT. Returns how many were deleted.
async function reconcile(ok, dead) {
  const writes = [];
  for (const e of ok) {
    if (e.failCount) writes.push(setFail(e, 0)); // healthy path writes nothing
  }
  let removed = 0;
  for (const e of dead) {
    const next = (e.failCount || 0) + 1;
    if (next >= FAILURE_LIMIT) {
      writes.push(removeToken(e));
      removed++;
    } else {
      writes.push(setFail(e, next));
    }
  }
  await Promise.all(writes);
  return removed;
}

function setFail(e, n) {
  if (e.tokenRef) return e.tokenRef.update({ failCount: n }).catch(() => null);
  return e.userRef.update({ fcmTokenFailCount: n }).catch(() => null);
}

function removeToken(e) {
  if (e.tokenRef) return e.tokenRef.delete().catch(() => null);
  return e.userRef.update({
    fcmToken: admin.firestore.FieldValue.delete(),
    fcmTokenFailCount: admin.firestore.FieldValue.delete(),
  }).catch(() => null);
}

// Sends a data-only payload to every token entry, retries the dead-reported
// ones exactly once, then reconciles the failure counters (deleting only tokens
// that reached FAILURE_LIMIT consecutive failures). Returns { sent, failed,
// removed }.
async function sendPush(entries, data) {
  if (!entries.length) return { sent: 0, failed: 0, removed: 0 };

  const first = await multicastOnce(entries, data);
  const ok = first.ok;
  let sent = first.sent;
  const failed = first.failed;
  let dead = first.dead;

  // One retry for the dead-reported tokens before we hold it against them.
  if (dead.length) {
    const retry = await multicastOnce(dead, data);
    sent += retry.sent;
    ok.push(...retry.ok);
    dead = retry.dead;
  }

  const removed = await reconcile(ok, dead);
  return { sent, failed, removed };
}

module.exports = {
  getTokensForUser,
  getAllTokens,
  sendPush,
};

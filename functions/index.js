const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret, defineString } = require("firebase-functions/params");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const {
  getTokensForUser,
  getAllTokens,
  sendPush,
} = require("./pushTokens");

admin.initializeApp();

const AGORA_APP_CERTIFICATE = defineSecret("AGORA_APP_CERTIFICATE");
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const DEEPSEEK_API_KEY = defineSecret("DEEPSEEK_API_KEY");
const DEEPGRAM_API_KEY = defineSecret("DEEPGRAM_API_KEY");
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

const AGORA_APP_ID = defineString("AGORA_APP_ID", {
  default: "98299e33a32f4137a94daacc5422c92e",
});
const APP_URL = defineString("APP_URL", {
  default: "https://speak2them.vercel.app",
});

const ADMIN_UID = "6Djehd9KB8dTZUgVwVJfLoPI5dF3";

function setCors(res, methods = "POST") {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", methods);
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function verifyAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("unauthorized");
  return admin.auth().verifyIdToken(token);
}

// Every AI endpoint costs money per call and was callable in a loop by any
// signed-in account. A rolling-window counter per user per endpoint keeps a
// real user well clear of the limit while bounding what one account can spend.
// The rateLimits collection is denied to clients by the catch-all rule.
async function enforceRateLimit(uid, key, maxCalls, windowMs) {
  const ref = admin.firestore().collection("rateLimits").doc(`${uid}_${key}`);
  const allowed = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    const windowStart = data && now - data.windowStart < windowMs ? data.windowStart : now;
    const count = windowStart === (data && data.windowStart) ? (data.count || 0) : 0;
    if (count >= maxCalls) return false;
    tx.set(ref, { windowStart, count: count + 1 });
    return true;
  });
  if (!allowed) {
    throw Object.assign(new Error(`Rate limit reached for ${key}`), { httpStatus: 429 });
  }
}

// ─── Kohort + Qlobal Mövzu Cycle-ı ─────────────────────────────
// Qlobal, heç vaxt sıfırlanmayan mövzu dövrü. cycleTick monoton artır;
// topicIndex = cycleTick % TOPIC_COUNT. Proqres per-user YAZILMIR — client
// currentCycleTick - startTick ilə hesablayır.
const TOPIC_COUNT = require("./dailyQuestions.json").length; // src/data/weeklyContent.js ilə eyni
const TRIAL_DAYS = 2;              // kodsuz trial: ilk girişdən 2 gün
const COURSE_FREE_MONTHS = 6;      // kurs bitəndən sonra pulsuz dövr
// Həftə günü konvensiyası: 0=Bazar … 6=Şənbə. Admin appConfig/session-da dəyişir.
const DEFAULT_SESSION_DAYS = [1, 3, 5];   // B.e / Çər / Cümə
const DEFAULT_BONUS_DAYS = [0];           // Bazar — həftənin 7-ci günü (bonus)

// Baku təqvim tarixi "YYYY-MM-DD" (UTC+4, DST yoxdur).
function bakuDateStr(ms = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date(ms));
}

// Baku tarixinin həftə günü (0=Bazar). Tarix sətrini UTC gecəyarısı kimi
// oxuyuruq ki, serverin saat qurşağından asılı olmayaraq deterministik olsun.
function bakuWeekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Davamlılıq toxumu: köhnə təqvim-günü formulu ilə eyni indeks, belə ki
// cycle ilk dəfə qurulanda mövcud userlər üçün mövzu sıçramır.
function seedTickForDate(dateStr) {
  const days = Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 86400000);
  return ((days % TOPIC_COUNT) + TOPIC_COUNT) % TOPIC_COUNT;
}

// appConfig/cycle-dən hazırkı topic indeksini oxuyur; sənəd hələ yoxdursa
// köhnə təqvim formuluna düşür.
async function readCycleIndex(db) {
  const snap = await db.collection("appConfig").doc("cycle").get().catch(() => null);
  if (snap && snap.exists && Number.isFinite(snap.data().currentTopicIndex)) {
    return snap.data().currentTopicIndex;
  }
  return seedTickForDate(bakuDateStr());
}

// Kodsuz trial ilk girişdən TRIAL_DAYS gün sonra bitir. Premium / pullu plan
// heç vaxt bloklanmır. Müstəsna yalnız rules-qorunan sahələrə (isPremium,
// subscriptionPlan) əsaslanır — client-yazıla bilən `mode` sahəsinə GÜVƏNMİRİK,
// yoxsa dəyişdirilmiş client mode:'course' qoyub 2 günlük limiti keçərdi.
// (Kurs istifadəçiləri redeemCode-da isPremium:true alır, ona görə müstəsnadır.)
// trialStartedAt olmayan köhnə userlər də bloklanmır.
function isTrialExpired(u) {
  if (!u) return false;
  if (u.isPremium) return false;
  if (u.freeAccessUntil && typeof u.freeAccessUntil.toMillis === "function"
    && u.freeAccessUntil.toMillis() > Date.now()) return false;
  if (u.subscriptionPlan && u.subscriptionPlan !== "trial" && u.subscriptionPlan !== "free") return false;
  const s = u.trialStartedAt;
  const startedMs = s && typeof s.toMillis === "function"
    ? s.toMillis()
    : (typeof s === "number" ? s : null);
  if (!startedMs) return false;
  return Date.now() - startedMs > TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Agora Token ───────────────────────────────────────────────
exports.getAgoraToken = onRequest({ secrets: [AGORA_APP_CERTIFICATE] }, async (req, res) => {
  setCors(res, "GET, POST");

  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const channelName = req.body.channelName || req.query.channelName;
  if (!channelName) { res.status(400).json({ error: "channelName required" }); return; }

  // A channel is named after its two participants ("uidA_uidB", or
  // "call_uidA_uidB"). Without this check any signed-in user could mint a
  // publisher token for a channel they are not part of and listen in on it —
  // uids are readable from the users collection, so channels are guessable.
  if (!String(channelName).split("_").includes(decoded.uid)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Kodsuz trial 2 gündən sonra zəngi serverdə bloklayır — token verilmir.
  const uDoc = await admin.firestore().collection("users").doc(decoded.uid).get().catch(() => null);
  if (isTrialExpired(uDoc && uDoc.exists ? uDoc.data() : null)) {
    res.status(403).json({ error: "trial_expired" });
    return;
  }

  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;

  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID.value(),
    AGORA_APP_CERTIFICATE.value().trim(),
    channelName,
    0,
    role,
    expireTime,
    expireTime
  );

  res.status(200).json({ token });
});

// ─── Zəng Bildirişi (incoming direct call → callee's device) ──
exports.sendCallNotification = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { callerId, receiverId } = req.body;
  if (!callerId || !receiverId) return res.status(400).json({ error: "callerId and receiverId required" });
  if (decoded.uid !== callerId) return res.status(403).json({ error: "Forbidden" });
  if (callerId === receiverId) return res.status(400).json({ error: "Cannot call yourself" });

  // The caller's name is resolved server-side, never trusted from the request,
  // so a client cannot spoof a "X is calling you" push to an arbitrary device.
  const db = admin.firestore();
  const callerSnap = await db.collection("users").doc(callerId).get().catch(() => null);
  const rawName = (callerSnap && callerSnap.exists ? callerSnap.data().name : "") || "Someone";
  const callerName = String(rawName).slice(0, 40);

  await sendPushToUser(db, receiverId, {
    title: `📞 ${callerName} sizə zəng edir`,
    body: "Qəbul etmək üçün tətbiqi açın",
    type: "incoming_call",
    url: "/",
  });
  res.status(200).json({ ok: true });
});

// ─── Premium Aktivləşdi — istifadəçiyə push göndər ────────────
exports.notifyPremiumActivated = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (decoded.uid !== ADMIN_UID) return res.status(403).json({ error: "Forbidden" });

  const { userId, userName } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const db = admin.firestore();
  await sendPushToUser(db, userId, {
    title: "👑 Premium aktivləşdirildi",
    body: `${userName || "Üzv"}, bütün premium xüsusiyyətlər indi sizin üçün açıqdır!`,
    type: "premium_activated",
    url: "/",
  });
  res.status(200).json({ ok: true });
});

// Snapshot of src/data/weeklyContent.js (topic + easy/hard questions per day),
// regenerated when the client content changes. The topic index now comes from
// the global cycle (appConfig/cycle) via readCycleIndex(), so push and app stay
// on the SAME topic and both advance only on session days.
const DAILY_CONTENT = require("./dailyQuestions.json");

// One concrete question per reminder slot: mornings pull from the easy half
// of the list, evenings from the hard half, and the day index shifts the
// rotation so the same slot asks something new each cycle.
function getQuestionForHour(content, hour) {
  const qs = content.questions || [];
  if (!qs.length) return "";
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const half = Math.ceil(qs.length / 2);
  const offset = hour >= 18 ? half : 0; // easy questions come first in the array
  const span = hour >= 18 ? qs.length - half : half;
  return qs[offset + ((daysSinceEpoch + hour) % Math.max(1, span))];
}

// ─── Qlobal Mövzu Cycle-ı bir addım irəli ──────────────────────
// Gündə bir dəfə (Baku 00:05) işləyir. Bugün sessiya (və ya bonus) günüdürsə
// VƏ bu tarix üçün hələ irəliləməyibsə, cycleTick +1 olur. İdempotent:
// lastAdvancedDate eyni gündə iki dəfə artımın qarşısını alır.
exports.advanceCycle = onSchedule({
  schedule: "5 0 * * *",
  timeZone: "Asia/Baku",
}, async () => {
  const db = admin.firestore();
  const cfgSnap = await db.collection("appConfig").doc("session").get().catch(() => null);
  const cfg = (cfgSnap && cfgSnap.exists) ? cfgSnap.data() : {};
  const sessionDays = Array.isArray(cfg.sessionDays) ? cfg.sessionDays : DEFAULT_SESSION_DAYS;
  const bonusDays = Array.isArray(cfg.bonusDays) ? cfg.bonusDays : DEFAULT_BONUS_DAYS;
  const activeDays = new Set([...sessionDays, ...bonusDays].map(Number));

  const today = bakuDateStr();
  const isSessionToday = activeDays.has(bakuWeekday(today));

  await db.runTransaction(async (tx) => {
    const ref = db.collection("appConfig").doc("cycle");
    const snap = await tx.get(ref);

    // İlk dəfə: davamlılıq üçün köhnə təqvim indeksi ilə toxumla. Bugün
    // sessiya günüdürsə bu toxum "bugünkü irəliləmə" sayılır.
    if (!snap.exists) {
      const seed = seedTickForDate(today);
      tx.set(ref, {
        cycleTick: seed,
        currentTopicIndex: seed % TOPIC_COUNT,
        lastAdvancedDate: isSessionToday ? today : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const data = snap.data();
    if (data.lastAdvancedDate === today) return; // bugün artıq irəlilədi
    if (!isSessionToday) return;                  // sessiya/bonus günü deyil

    const nextTick = (Number(data.cycleTick) || 0) + 1;
    tx.set(ref, {
      cycleTick: nextTick,
      currentTopicIndex: nextTick % TOPIC_COUNT,
      lastAdvancedDate: today,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
});

// ─── Topic Practice Reminder ──────────────────────────────────
exports.topicReminder = onSchedule({
  schedule: "0 10,15,21 * * *",
  timeZone: "Asia/Baku",
}, async () => {
  const db = admin.firestore();
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map(d => ({ ref: d.ref, fcmToken: d.data().fcmToken, fcmTokenFailCount: d.data().fcmTokenFailCount }));
  const tokenEntries = await getAllTokens(db, users);

  // A concrete question pulls far better than a bare topic name: the reader
  // can start answering it in their head before they even open the app.
  // Mövzu artıq qlobal cycle-dan gəlir (köhnə təqvim-günü formulu deyil).
  const cycleIndex = await readCycleIndex(db);
  const todayContent = DAILY_CONTENT[((cycleIndex % DAILY_CONTENT.length) + DAILY_CONTENT.length) % DAILY_CONTENT.length];
  const bakuHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku", hour: "2-digit", hour12: false,
  }).format(new Date()));
  const question = getQuestionForHour(todayContent, bakuHour);

  // Data-only so the messaging SW renders it and routes the click to `url`.
  // A `notification` payload is auto-displayed by the SDK and bypasses the
  // SW's notificationclick handler.
  const { sent, failed, removed } = await sendPush(tokenEntries, {
    title: `💬 ${todayContent.topic}`,
    body: question
      ? `${question} — Cavabını düşün və daxil ol!`
      : "Daxil ol və bu mövzuda öyrəndiklərini təcrübədən keçir!",
    type: "daily_reminder",
    url: "/?daily=1",
  });

  console.log("Daily reminder complete", {
    users: usersSnap.size,
    tokens: tokenEntries.length,
    sent,
    failed,
    invalidTokensRemoved: removed,
  });
});

// ─── Streak Rescue Reminder ───────────────────────────────────
// The classic retention push: anyone whose streak is alive but who hasn't
// called TODAY gets nudged in the evening — a gentle heads-up at 19:00 and an
// urgent one at 22:00. lastCallDate is written by Chat.jsx as toDateString()
// in the user's local timezone; at these Baku hours the server's UTC calendar
// date matches Baku's, so a plain toDateString() comparison holds for the
// (Azerbaijani) user base.
exports.streakReminder = onSchedule({
  schedule: "0 19,22 * * *",
  timeZone: "Asia/Baku",
}, async () => {
  const db = admin.firestore();
  const snap = await db.collection("users").where("streak", ">=", 1).get();
  const today = new Date().toDateString();

  const atRisk = snap.docs
    .map((d) => ({ ref: d.ref, ...d.data() }))
    .filter((u) => u.lastCallDate && u.lastCallDate !== today);

  if (atRisk.length === 0) {
    console.log("[StreakReminder] nobody at risk");
    return;
  }

  const bakuHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku", hour: "2-digit", hour12: false,
  }).format(new Date()));
  const urgent = bakuHour >= 21;

  let sent = 0;
  let removed = 0;
  // Messages are personalised with the streak count, so send per-user rather
  // than one shared multicast; the at-risk set is small (streak>=1 AND idle
  // today). Each user may have several devices — all get the nudge.
  for (const u of atRisk) {
    const entries = await getTokensForUser(db, u.ref.id, u.fcmToken, u.fcmTokenFailCount);
    if (!entries.length) continue;
    const streak = u.streak || 1;
    const { sent: s, removed: r } = await sendPush(entries, urgent
      ? {
          title: "⚠️ Streak-in bu gecə sönəcək!",
          body: `${streak} günlük əziyyətin gecə yarısı sıfırlanır. Qısa bir zəng kifayətdir! 🔥`,
          type: "streak_rescue",
          url: "/",
        }
      : {
          title: `🔥 ${streak} günlük streak-in gözləyir`,
          body: "Bu gün hələ danışmamısan — bir zəng et, alovu qoru!",
          type: "streak_rescue",
          url: "/",
        });
    sent += s;
    removed += r;
  }

  console.log("[StreakReminder]", { atRisk: atRisk.length, sent, urgent, invalidTokensRemoved: removed });
});

exports.testPush = onRequest({ secrets: [] }, async (req, res) => {
  const db = admin.firestore();
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map(d => ({ ref: d.ref, fcmToken: d.data().fcmToken, fcmTokenFailCount: d.data().fcmTokenFailCount }));
  const tokenEntries = await getAllTokens(db, users);

  if (tokenEntries.length === 0) return res.status(200).json({ error: "No users with tokens" });

  const { sent, failed } = await sendPush(tokenEntries, {
    title: "🛠️ SpeakLab Test Mesajı",
    body: "Bu mesaj push bildirişlərinin düzgün işlədiyini yoxlamaq üçün göndərilmişdir.",
    type: "test",
    url: "/",
  });

  res.status(200).json({ sent, failed, tokens: tokenEntries.length });
});

// ─── Trial / Subscription ────────────────────────────────────
const TRIAL_MINUTES = 100;
const CALL_CAP_SECONDS = 20 * 60; // calls are capped at 20 minutes
const METERED_PLANS = new Set(["free", "trial"]);

// Every new user starts on a 100-minute trial. Written server-side because
// subscriptionPlan/availableTrialMinutes are locked to clients by the rules.
exports.initTrialForNewUser = onDocumentCreated("users/{userId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() || {};
  if (data.subscriptionPlan) return; // already provisioned (e.g. admin-granted)
  await snap.ref.set({
    subscriptionPlan: "trial",
    availableTrialMinutes: TRIAL_MINUTES,
    trialGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
});

// Bills a finished call against the caller's trial (then bonus) minutes.
// Server-authoritative: the duration is computed from the call's own timestamps,
// never taken from the client, and each participant is billed once per call.
exports.consumeTrialMinutes = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { callId } = req.body;
  if (!callId || typeof callId !== "string") return res.status(400).json({ error: "callId required" });

  const db = admin.firestore();
  const uid = decoded.uid;
  const callRef = db.collection("calls").doc(callId);
  const userRef = db.collection("users").doc(uid);
  const billedFlag = `minutesBilled_${uid}`;

  try {
    const remaining = await db.runTransaction(async (tx) => {
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) throw Object.assign(new Error("Call not found"), { httpStatus: 404 });
      const call = callSnap.data() || {};

      const participants = [call.userA, call.userB, call.callerId, call.receiverId].filter(Boolean);
      if (!participants.includes(uid)) throw Object.assign(new Error("Not a participant"), { httpStatus: 403 });
      if (call[billedFlag]) return null; // already billed for this user — idempotent

      const startMs = (call.matchedAt && call.matchedAt.toMillis && call.matchedAt.toMillis())
        || (call.createdAt && call.createdAt.toMillis && call.createdAt.toMillis()) || 0;
      const elapsedSec = startMs ? Math.max(0, Math.floor((Date.now() - startMs) / 1000)) : 0;
      const billedSec = Math.min(elapsedSec, CALL_CAP_SECONDS);
      const minutes = Math.ceil(billedSec / 60);

      const userSnap = await tx.get(userRef);
      const user = userSnap.exists ? userSnap.data() : {};
      const metered = METERED_PLANS.has(user.subscriptionPlan || "free");

      tx.update(callRef, { [billedFlag]: true });
      if (!metered || minutes <= 0) return null; // paid plans / no-op calls: mark billed, don't decrement

      const trial = Number(user.availableTrialMinutes) || 0;
      const bonus = Number(user.bonusMinutes) || 0;
      const fromTrial = Math.min(trial, minutes);
      const fromBonus = Math.min(bonus, minutes - fromTrial);

      tx.set(userRef, {
        availableTrialMinutes: trial - fromTrial,
        bonusMinutes: bonus - fromBonus,
      }, { merge: true });
      return (trial - fromTrial) + (bonus - fromBonus);
    });

    return res.status(200).json({ ok: true, remaining });
  } catch (e) {
    return res.status(e.httpStatus || 500).json({ error: e.message });
  }
});

// One-time admin action: put every pre-existing user who has no plan yet onto
// the trial. Skips users who already have a plan or are premium, so it is safe
// to run more than once.
exports.backfillTrials = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (decoded.uid !== ADMIN_UID) return res.status(403).json({ error: "Forbidden" });

  const db = admin.firestore();
  const snap = await db.collection("users").get();
  let granted = 0;
  let batch = db.batch();
  let ops = 0;
  for (const d of snap.docs) {
    const u = d.data() || {};
    if (u.subscriptionPlan || u.isPremium) continue;
    batch.set(d.ref, {
      subscriptionPlan: "trial",
      availableTrialMinutes: TRIAL_MINUTES,
      trialGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    granted++;
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops > 0) await batch.commit();

  return res.status(200).json({ ok: true, granted, total: snap.size });
});

// ─── Kurs kodu ilə aktivləşdirmə (server-side) ─────────────────
// Kohort sənədində kodu tapır, statusu/limiti yoxlayır, useri KURS moduna
// keçirir və startTick-i (o andakı cycleTick) BİR DƏFƏ yazır. Bütün yoxlama
// serverdə — client-side yoxlama yoxdur.
exports.redeemCode = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const code = String((req.body && req.body.code) || "").trim().toUpperCase();
  if (code.length < 4 || code.length > 40) {
    return res.status(400).json({ error: "invalid_code" });
  }

  try {
    await enforceRateLimit(decoded.uid, "redeemCode", 10, 60 * 60 * 1000);
  } catch (e) {
    return res.status(e.httpStatus || 429).json({ error: "rate_limited" });
  }

  const db = admin.firestore();
  const q = await db.collection("cohorts").where("code", "==", code).limit(1).get();
  if (q.empty) return res.status(404).json({ error: "code_not_found" });
  const cohortRef = q.docs[0].ref;

  try {
    const result = await db.runTransaction(async (tx) => {
      // Bütün oxumalar yazmalardan əvvəl.
      const cohortSnap = await tx.get(cohortRef);
      const cohort = cohortSnap.data() || {};
      const userRef = db.collection("users").doc(decoded.uid);
      const userSnap = await tx.get(userRef);
      const u = userSnap.data() || {};

      if (cohort.status && cohort.status !== "active") return { error: "code_inactive" };

      // İdempotent — user artıq bu axının bir mərhələsindədirsə heç nə əlavə
      // etmə, sadəcə mövcud vəziyyəti qaytar (double-count olmasın).
      if (u.mode === "course" && Number.isFinite(u.startTick)) {
        return { alreadyActive: true, cohortId: cohortRef.id };
      }
      if (u.cohortId === cohortRef.id && (u.cohortStatus === "pending" || u.cohortStatus === "accepted")) {
        return { alreadyApplied: true, cohortId: cohortRef.id, status: u.cohortStatus };
      }

      // maxUses = ümumi yer: gözləyənlər (pending+accepted) + aktiv üzvlər.
      const maxUses = Number(cohort.maxUses) || 0;
      const seats = (Number(cohort.pendingCount) || 0) + (Number(cohort.memberCount) || 0);
      if (maxUses > 0 && seats >= maxUses) return { error: "code_exhausted" };

      // Müraciət — kurs/premium AKTİVLƏŞMİR. Admin qəbul edib sonra başladır.
      tx.set(userRef, {
        cohortId: cohortRef.id,
        cohortStatus: "pending",
        cohortAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.update(cohortRef, { pendingCount: admin.firestore.FieldValue.increment(1) });
      return { applied: true, cohortId: cohortRef.id, status: "pending" };
    });

    if (result.error) {
      const map = { code_inactive: 400, code_exhausted: 409 };
      return res.status(map[result.error] || 400).json({ error: result.error });
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("[redeemCode]", e);
    return res.status(500).json({ error: "redeem_failed" });
  }
});

// ─── Kohortu Başlat (yalnız admin) ─────────────────────────────
// Admin "başlat" deyəndə həmin kohortun BÜTÜN qəbul edilmiş (accepted)
// üzvlərini eyni anda, ortaq startTick ilə aktivləşdirir: kurs + premium.
// Beləcə kursun "başlanğıc günü" adminin əlindədir; user yalnız müraciət edir.
exports.startCohort = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (decoded.uid !== ADMIN_UID) return res.status(403).json({ error: "forbidden" });

  const cohortId = String((req.body && req.body.cohortId) || "").trim();
  if (!cohortId) return res.status(400).json({ error: "cohortId_required" });

  const db = admin.firestore();
  try {
    // Ortaq startTick — cycle sənədi yoxdursa toxumla.
    const cycleRef = db.collection("appConfig").doc("cycle");
    const cycleSnap = await cycleRef.get();
    let startTick;
    if (cycleSnap.exists && Number.isFinite(cycleSnap.data().cycleTick)) {
      startTick = Number(cycleSnap.data().cycleTick);
    } else {
      startTick = seedTickForDate(bakuDateStr());
      await cycleRef.set({
        cycleTick: startTick,
        currentTopicIndex: startTick % TOPIC_COUNT,
        lastAdvancedDate: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Kohortun üzvlərini bir sorğu ilə çək, accepted olanları yaddaşda süz
    // (cohortId+cohortStatus kompozit indeks tələb etməsin — kohortlar kiçikdir).
    const all = await db.collection("users").where("cohortId", "==", cohortId).get();
    const acceptedDocs = all.docs.filter((d) => d.data().cohortStatus === "accepted");
    if (acceptedDocs.length === 0) {
      return res.status(200).json({ ok: true, started: 0, startTick });
    }

    let started = 0;
    for (let i = 0; i < acceptedDocs.length; i += 400) {
      const batch = db.batch();
      acceptedDocs.slice(i, i + 400).forEach((d) => {
        batch.set(d.ref, {
          mode: "course",
          startTick,
          cohortStatus: "active",
          subscriptionPlan: "unlimited",
          isPremium: true,
          premiumSince: admin.firestore.FieldValue.serverTimestamp(),
          premiumPlan: "course",
          courseActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      started += Math.min(400, acceptedDocs.length - i);
    }

    await db.collection("cohorts").doc(cohortId).set({
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      startTick,
      memberCount: admin.firestore.FieldValue.increment(started),
      pendingCount: admin.firestore.FieldValue.increment(-started),
    }, { merge: true });

    return res.status(200).json({ ok: true, started, startTick });
  } catch (e) {
    console.error("[startCohort]", e);
    return res.status(500).json({ error: "start_failed" });
  }
});

// ─── Kurs tamamlanmasını təsdiqlə (28/28) ──────────────────────
// Client lokal olaraq topicsCompleted>=28 aşkarlayanda çağırır; server
// cycleTick - startTick ilə YENİDƏN yoxlayır (client-ə etibar etmir), sonra
// courseCompletedAt + freeAccessUntil (+6 ay) yazır. Bir dəfəlik, per-user
// cron olmadan.
exports.claimCourseCompletion = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = admin.firestore();
  try {
    const result = await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(decoded.uid);
      const userSnap = await tx.get(userRef);
      const u = userSnap.data() || {};
      const cycleSnap = await tx.get(db.collection("appConfig").doc("cycle"));

      if (u.mode !== "course" || !Number.isFinite(u.startTick)) return { error: "not_course" };
      if (u.courseCompletedAt) return { alreadyClaimed: true };

      const tick = cycleSnap.exists ? Number(cycleSnap.data().cycleTick) : NaN;
      if (!Number.isFinite(tick)) return { error: "no_cycle" };

      const completed = Math.min(TOPIC_COUNT, tick - u.startTick);
      if (completed < TOPIC_COUNT) return { error: "not_complete", completed };

      const until = new Date();
      until.setMonth(until.getMonth() + COURSE_FREE_MONTHS);
      tx.set(userRef, {
        courseCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        freeAccessUntil: admin.firestore.Timestamp.fromDate(until),
      }, { merge: true });
      return { completed: true };
    });

    if (result.error) return res.status(400).json(result);
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("[claimCourseCompletion]", e);
    return res.status(500).json({ error: "claim_failed" });
  }
});

// ─── Peer Təhlükəsiz Yeniləmə (Rating & Badges) ─────────────
exports.updatePeerStats = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { peerId, callId, updates, stars } = req.body;
  if (!peerId || typeof peerId !== "string" || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "peerId and updates required" });
  }
  if (!callId || typeof callId !== "string") {
    return res.status(400).json({ error: "callId required" });
  }
  // `stars` is the modern shape: the caller states its vote and the totals are
  // derived here, inside the transaction. Older clients send the totals instead.
  const hasStars = stars !== undefined;
  if (hasStars && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
    return res.status(400).json({ error: "stars must be an integer 1-5" });
  }
  if (peerId === decoded.uid) {
    return res.status(403).json({ error: "Cannot update own stats via this endpoint" });
  }

  const db = admin.firestore();
  const peerRef = db.collection("users").doc(peerId);
  const callRef = db.collection("calls").doc(callId);
  const ratedFlag = `ratedBy_${decoded.uid}`;

  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  // calls/{id} is keyed by the pair, not by the call: the same two users reuse
  // one document for every call they ever have. So "already rated" has to mean
  // "already rated THIS call", identified by when it started. matchedAt (or
  // createdAt) is rewritten each time a call begins, so it names the instance.
  const callInstance = (call) => {
    const at = call.matchedAt || call.createdAt;
    return at && at.toMillis ? at.toMillis() : 0;
  };

  try {
    // One transaction so a rating is proven, applied and recorded atomically.
    // Previously the peer's document was read outside any transaction and the
    // endpoint asked for no proof that a call had happened, so ratings, badges
    // and bonus minutes could be granted repeatedly to any user.
    await db.runTransaction(async (tx) => {
      const callSnap = await tx.get(callRef);
      if (!callSnap.exists) throw fail(404, "Call not found");
      const call = callSnap.data() || {};

      const participants = [call.userA, call.userB, call.callerId, call.receiverId].filter(Boolean);
      if (!participants.includes(decoded.uid) || !participants.includes(peerId)) {
        throw fail(403, "Not a participant of this call");
      }
      const instance = callInstance(call);
      if (instance && call[ratedFlag] === instance) {
        throw fail(409, "This call has already been rated");
      }

      const peerSnap = await tx.get(peerRef);
      if (!peerSnap.exists) throw fail(404, "Peer not found");
      const peerData = peerSnap.data() || {};

      const allowedKeys = ["rating", "ratingCount", "receivedFiveStar", "badges", "bonusMinutes"];
      const safeUpdates = {};
      for (const key of allowedKeys) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key];
      }

      if (hasStars) {
        // Derived from the values just read in this transaction, so a rating
        // that landed while the user was choosing stars cannot invalidate it.
        safeUpdates.rating = (typeof peerData.rating === "number" ? peerData.rating : 0) + stars;
        safeUpdates.ratingCount = (typeof peerData.ratingCount === "number" ? peerData.ratingCount : 0) + 1;
        if (stars === 5) safeUpdates.receivedFiveStar = true;
        else delete safeUpdates.receivedFiveStar;
      }

      // rating may only rise by one vote's worth, ratingCount by exactly one.
      if (safeUpdates.rating !== undefined) {
        const prevRating = typeof peerData.rating === "number" ? peerData.rating : 0;
        const delta = safeUpdates.rating - prevRating;
        if (typeof safeUpdates.rating !== "number" || !Number.isFinite(delta) || delta < 1 || delta > 5) {
          throw fail(400, "Invalid rating value");
        }
      }
      if (safeUpdates.ratingCount !== undefined) {
        const prevCount = typeof peerData.ratingCount === "number" ? peerData.ratingCount : 0;
        if (safeUpdates.ratingCount !== prevCount + 1) throw fail(400, "Invalid ratingCount value");
      }
      if (safeUpdates.receivedFiveStar !== undefined && safeUpdates.receivedFiveStar !== true) {
        throw fail(400, "Invalid receivedFiveStar value");
      }
      if (safeUpdates.badges !== undefined) {
        const badgesValid = Array.isArray(safeUpdates.badges)
          && safeUpdates.badges.length <= 100
          && safeUpdates.badges.every((b) => typeof b === "string" && b.length <= 64);
        if (!badgesValid) throw fail(400, "Invalid badges value");
      }
      if (safeUpdates.bonusMinutes !== undefined) {
        if (typeof safeUpdates.bonusMinutes !== "number"
          || safeUpdates.bonusMinutes < 0
          || safeUpdates.bonusMinutes > 10000) {
          throw fail(400, "Invalid bonusMinutes value");
        }
      }

      if (updates.badgeUpdatedAt === "SERVER_TIMESTAMP") {
        safeUpdates.badgeUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
      }
      if (Object.keys(safeUpdates).length === 0) throw fail(400, "No valid fields to update");

      tx.update(peerRef, safeUpdates);
      tx.update(callRef, { [ratedFlag]: instance });
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[updatePeerStats]", e.message);
    res.status(status).json({ error: e.message });
  }
});

// ─── AI Quiz Generation (DeepSeek proxy) ──────────────────────────
// invoker: "public" is required, not optional. Cloud Run rejects the browser's
// CORS preflight (an OPTIONS with no Authorization header) before our handler
// runs, so the response carries no Access-Control-Allow-Origin and the browser
// reports a CORS failure. Callers are still authenticated by verifyAuth below.
exports.generateQuiz = onRequest({ secrets: [GROQ_API_KEY], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await enforceRateLimit(decoded.uid, "generateQuiz", 20, 60 * 60 * 1000);
  } catch (e) {
    return res.status(429).json({ error: "Çox sürətli — bir azdan yenidən cəhd et." });
  }

  const { translatedItems } = req.body;
  const itemsValid = Array.isArray(translatedItems)
    && translatedItems.length > 0
    && translatedItems.length <= 50
    && translatedItems.every((w) =>
      w
      && typeof w.original === "string" && w.original.length > 0 && w.original.length <= 200
      && typeof w.translated === "string" && w.translated.length > 0 && w.translated.length <= 200);
  if (!itemsValid) {
    return res.status(400).json({ error: "translatedItems must be a non-empty array of {original, translated}" });
  }

  const sampleSize = Math.min(translatedItems.length, 5);
  const shuffled = [...translatedItems].sort(() => 0.5 - Math.random());
  const selectedItems = shuffled.slice(0, sampleSize);

  // Interpolating the words straight into the prompt with quotes around them is
  // what broke the model's JSON: an apostrophe in a word closed the string it
  // was copying. JSON-encoding the list keeps every quote already escaped.
  const wordsList = JSON.stringify(
    selectedItems.map((w) => ({ english: w.original, azerbaijani: w.translated })),
  );

  const prompt = `
      You are a friendly English practice partner helping an Azerbaijani friend.
      They have just learned these English words/phrases during a conversation:
      ${wordsList}

      Generate a quick multiple-choice quiz (1 question per word) to test their memory.
      The questions must be in Azerbaijani. The options can be either in English or Azerbaijani depending on what is being asked.

      Output rules — these are strict:
      - Return ONLY a single valid JSON object. No prose, no markdown fences.
      - Use double quotes for every key and string. Escape any double quote inside a string as \\".
      - "options" must hold exactly 3 distinct strings, and "correctIdx" must be 0, 1 or 2.

      Format:
      {
        "quiz": [
          {
            "qText": "Question text in Azerbaijani",
            "options": ["Option 1", "Option 2", "Option 3"],
            "correctIdx": 0
          }
        ]
      }
    `;

  const askGroq = async (temperature) => {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY.value()}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature,
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.text().catch(() => "");
      console.error("[generateQuiz] Groq error:", groqRes.status, err);
      // Groq rejects its own malformed JSON with a 400 and hands the broken text
      // back. It is usually one bad escape away from valid, so try to repair it.
      const salvaged = salvageFailedGeneration(err);
      if (salvaged) return salvaged;
      throw new Error(`Groq error: ${groqRes.status}`);
    }

    const data = await groqRes.json();
    const responseText = data.choices?.[0]?.message?.content;
    if (!responseText) throw new Error("No response from Groq");
    return parseJsonLoose(responseText);
  };

  // A quiz over the user's own words does not actually need a model, so a model
  // failure must not become a 500 the user reads as "the AI is broken".
  let quiz = [];
  try {
    quiz = sanitizeQuiz(await askGroq(0.6));
  } catch (error) {
    console.error("[generateQuiz] First attempt failed:", error.message);
  }
  if (quiz.length === 0) {
    try {
      // Greedy decoding: the same prompt, but far less likely to wander out of
      // the JSON grammar a second time.
      quiz = sanitizeQuiz(await askGroq(0));
    } catch (error) {
      console.error("[generateQuiz] Retry failed:", error.message);
    }
  }
  if (quiz.length === 0) {
    console.warn("[generateQuiz] Falling back to a locally built quiz");
    quiz = buildFallbackQuiz(selectedItems, translatedItems);
  }

  if (quiz.length === 0) {
    return res.status(422).json({ error: "Bu sözlərdən sınaq hazırlamaq alınmadı." });
  }
  res.status(200).json({ quiz });
});

// Pulls the model's rejected output out of a Groq json_validate_failed body and
// tries to parse it with the loose parser.
function salvageFailedGeneration(errorBody) {
  try {
    const failed = JSON.parse(errorBody)?.error?.failed_generation;
    if (typeof failed !== "string") return null;
    return parseJsonLoose(failed);
  } catch {
    return null;
  }
}

// Accepts either a bare array or a wrapper object, then keeps only the questions
// that are actually renderable: the client indexes options by correctIdx and
// prints qText, so a malformed entry is a crash, not a cosmetic issue.
function sanitizeQuiz(parsed) {
  let questions = parsed;
  if (!Array.isArray(questions)) {
    if (!questions || typeof questions !== "object") return [];
    questions = Object.values(questions).find(Array.isArray) || [];
  }
  return questions
    .filter((q) =>
      q
      && typeof q.qText === "string" && q.qText.trim().length > 0
      && Array.isArray(q.options)
      && q.options.length >= 2 && q.options.length <= 4
      && q.options.every((o) => typeof o === "string" && o.trim().length > 0)
      && Number.isInteger(q.correctIdx)
      && q.correctIdx >= 0 && q.correctIdx < q.options.length)
    .map((q) => ({
      qText: q.qText.trim(),
      options: q.options.map((o) => o.trim()),
      correctIdx: q.correctIdx,
    }))
    .slice(0, 5);
}

// The words and their translations are all the quiz needs: ask for the meaning
// of each word, and draw the wrong options from the other words of the call.
function buildFallbackQuiz(selectedItems, allItems) {
  return selectedItems.map((item) => {
    const distractors = allItems
      .filter((w) => w.translated !== item.translated)
      .map((w) => w.translated)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    // With fewer than three distinct words there is nothing plausible to offer
    // as a wrong answer, so a two-option question is the honest maximum.
    const options = [item.translated, ...distractors].sort(() => 0.5 - Math.random());
    if (options.length < 2) return null;
    return {
      qText: `"${item.original}" sözünün mənası nədir?`,
      options,
      correctIdx: options.indexOf(item.translated),
    };
  }).filter(Boolean);
}

// ─── AI Partner (Voice Chat with AInur) ───────────────────────────
exports.chatWithAI = onRequest({ secrets: [GROQ_API_KEY, DEEPGRAM_API_KEY], memory: "1GiB" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await enforceRateLimit(decoded.uid, "chatWithAI", 40, 60 * 60 * 1000);
  } catch (e) {
    return res.status(429).json({ error: "Çox sürətli — bir azdan yenidən cəhd et." });
  }

  const { base64Audio, history = [], userLevel = 'B1', topic = 'General', mimeType = 'audio/webm' } = req.body;
  if (!base64Audio) {
    return res.status(400).json({ error: "base64Audio required" });
  }
  // ~6 MB of audio. Unbounded, a single request could exhaust the 1 GiB
  // instance and be billed for the transcription of anything sent.
  if (typeof base64Audio !== "string" || base64Audio.length > 8000000) {
    return res.status(413).json({ error: "Audio too large" });
  }
  if (!Array.isArray(history) || history.length > 20) {
    return res.status(400).json({ error: "history must be an array of at most 20 turns" });
  }

  try {
    const audioBuffer = Buffer.from(base64Audio, "base64");
    if (audioBuffer.length < 100) {
      return res.status(400).json({ error: "Audio file is too small." });
    }
    const blob = new Blob([audioBuffer], { type: mimeType });
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";

    // 1. Transcription via Groq Whisper
    const groqForm = new FormData();
    groqForm.append("file", blob, `audio.${ext}`);
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("response_format", "json");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY.value()}` },
      body: groqForm
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return res.status(500).json({ error: "Groq Whisper error: " + err });
    }

    const groqData = await groqRes.json();
    const transcript = groqData.text;

    if (!transcript || transcript.trim() === "") {
      return res.status(400).json({ error: "Could not hear any speech in the audio." });
    }

    // 2. Generate AI Reply via Groq LLM (Llama 3 8B or 70B)
    const systemPrompt = `You are AInur, a friendly English tutor. 
The user's English level is ${userLevel}. Speak clearly, simply, and naturally at this level.
Today's topic is: ${topic}.
You are having a casual voice conversation. Keep your responses VERY CONCISE (1-3 short sentences). 
Do NOT use markdown, emojis, or special characters. Speak like a real human on a phone call. 
Ask a follow-up question to keep the conversation going.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: transcript }
    ];

    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY.value()}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Fast and good for casual conversation
        messages: messages,
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      return res.status(500).json({ error: "Groq LLM error: " + err });
    }

    const chatData = await chatRes.json();
    const aiReply = chatData.choices?.[0]?.message?.content || "I didn't quite catch that. Could you repeat?";

    // 3. Generate Speech via Deepgram Aura
    const dgRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
      method: "POST",
      headers: {
        "Authorization": `Token ${DEEPGRAM_API_KEY.value()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: aiReply })
    });

    if (!dgRes.ok) {
      const err = await dgRes.text();
      return res.status(500).json({ error: "Deepgram TTS error: " + err });
    }

    const arrayBuffer = await dgRes.arrayBuffer();
    const audioOutBase64 = Buffer.from(arrayBuffer).toString("base64");

    res.status(200).json({ 
      transcript, 
      aiReply, 
      audioBase64: audioOutBase64 
    });

  } catch (error) {
    console.error("[chatWithAI] Function error:", error);
    res.status(500).json({ error: error.message });
  }
});
// ─── Analysis Queue Worker ─────────────────────────────────────────
// Claims pending analysisQueue tickets, runs Groq Whisper + Llama on the
// uploaded recording and writes the result into callAnalysis/{ticketId}.
const ANALYSIS_CLAIM_LIMIT = 3;
const ANALYSIS_MAX_RETRIES = 3;
const ANALYSIS_STUCK_MS = 10 * 60 * 1000;
// Stop claiming new tickets this far into the 540s invocation, so a ticket is
// never orphaned mid-flight by the function timeout. The bound must leave room
// for one whole ticket: Whisper 120s + up to three 60s chat attempts + the
// download ≈ 310s, so claiming must stop by 540 - 310 = 230s. 200s keeps a
// margin, and a normal ticket takes ~30s, so all three still fit in a tick.
const ANALYSIS_INVOCATION_BUDGET_MS = 200 * 1000;
// 80% of Groq's free-tier 7200 audio-seconds/hour, rolling window.
const ANALYSIS_HOURLY_AUDIO_BUDGET = 5760;

const ANALYSIS_PROMPT = `You are the learner's warm, supportive English speaking PARTNER — a close friend who practised with them, not a teacher and not a school. Talk to them like a friend who is genuinely happy about their progress and wants to help them get better.

TRANSCRIPT:
"""{{TRANSCRIPT}}"""

Return ONLY a valid JSON object. No markdown, no text outside the JSON.

VOICE (Azerbaijani text fields):
- Write in warm, friendly, modern spoken Azerbaijani, addressing them informally as "sən".
- NEVER call them "Müəllim" or "Şagird". Never address, label, or lecture them as a pupil, and never speak as a teacher/school. You are a peer and friend.
- Sound human and encouraging, never clinical or robotic.

IGNORE MICROPHONE NOISE:
- The transcript is auto-generated and may contain garbled, non-English, or nonsensical tokens from mic noise (e.g. "Já, þess", random symbols, foreign gibberish). These are NOT things the learner said.
- Do NOT correct, mention, or put such noise in feedback. Analyze only the intelligible English speech and silently skip the rest.

Rules:
- Correct ONLY real grammatical or lexical mistakes. If a sentence is already correct, leave it alone.
- Never rewrite for style: do not swap "is not" for "isn't", do not reorder correct clauses, do not offer alternatives to correct sentences.
- feedback: at most 5 items, the most valuable ones. original = the learner's exact sentence, corrected = the fixed sentence, reason = why it was wrong. Empty array if there are no real mistakes.
- scores: fluency = flow and natural delivery; grammar = correctness; vocabulary = range and level. Integers 0-100.
- recap: 1-2 sentences on what the learner talked about.
- strengths: 1-2 concrete things they genuinely did well in this conversation.
- tips: 2-3 tips that are SPECIFIC to mistakes actually made in THIS transcript — name the concrete pattern (e.g. a missing article before a specific noun, a specific past-tense slip) and give a usable mini-technique or tiny example. Do NOT give generic filler such as "qorxma", "sadə saxla", or "daha çox danış".
- vocabulary: 3-4 useful or slightly advanced words or phrases, each with a natural example sentence. Skip basic words.
- recap, reason, strengths and tips must be written in Azerbaijani. word and example stay in English.
- corrected sentences and example sentences must sound like simple, natural, modern native-speaker English.
- Keep every text field to one sentence. Base everything on the transcript; invent nothing.
- Be encouraging and honest — a friend who cheers real progress and points out real mistakes gently.`;

// Whisper can return very long transcripts; the JSON answer must still fit in
// the completion budget, so the model only sees a bounded slice.
const MAX_TRANSCRIPT_CHARS = 6000;

// Strict schema enforced at the Groq API level (structured outputs).
// maxItems is what keeps the completion small: with these caps a full answer is
// ~600 output tokens, which is why ANALYSIS_MAX_TOKENS can start low.
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recap", "scores", "feedback", "strengths", "tips", "vocabulary"],
  properties: {
    recap: { type: "string" },
    scores: {
      type: "object",
      additionalProperties: false,
      required: ["fluency", "grammar", "vocabulary"],
      properties: {
        fluency: { type: "integer", minimum: 0, maximum: 100 },
        grammar: { type: "integer", minimum: 0, maximum: 100 },
        vocabulary: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    feedback: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "corrected", "reason"],
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    strengths: { type: "array", maxItems: 2, items: { type: "string" } },
    tips: { type: "array", maxItems: 3, items: { type: "string" } },
    vocabulary: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "example"],
        properties: {
          word: { type: "string" },
          example: { type: "string" },
        },
      },
    },
  },
};

function isRetryableStatus(httpStatus) {
  return httpStatus === 429 || httpStatus >= 500;
}

// An upstream request that never returns would hold the whole invocation until
// the 540s function timeout, leaving its ticket wedged in "processing". Bound
// each call so a hang fails fast and is retried on the next tick instead.
const GROQ_WHISPER_TIMEOUT_MS = 120000;
const GROQ_CHAT_TIMEOUT_MS = 60000;

async function fetchWithTimeout(url, options, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw Object.assign(new Error(`${label} timed out after ${timeoutMs}ms`), { retryable: true });
    }
    // Network blips are worth another tick.
    throw Object.assign(error, { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}

// Tolerant JSON parser: strips code fences, extracts the outermost object,
// and repairs common model glitches (trailing commas, smart quotes).
function parseJsonLoose(text) {
  if (!text || typeof text !== "string") throw new Error("empty model response");
  let s = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  try {
    return JSON.parse(s);
  } catch (e) {
    const repaired = s
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired);
  }
}

// Speaking pace is computed deterministically from the transcript — the LLM
// never hears audio, so asking it to estimate pace would only hallucinate.
function computeSpeakingPace(transcript, analyzeSeconds) {
  const words = String(transcript || "").trim().split(/\s+/).filter(Boolean).length;
  const seconds = analyzeSeconds > 0 ? analyzeSeconds : 0;
  const wpm = seconds > 0 ? Math.round((words / seconds) * 60) : 0;
  let label = "Normal";
  if (wpm > 0 && wpm < 90) label = "Yavaş";
  else if (wpm > 160) label = "Sürətli";
  return { wpm, label };
}

// Telling the model "don't rewrite correct sentences" is necessary but not
// sufficient — it still slips in contraction swaps and punctuation tweaks. So
// the rule is also enforced here, deterministically: two sentences that differ
// only in contractions, casing or punctuation are not a correction.
const CONTRACTIONS = [
  [/\bcan ?not\b/g, "can't"], [/\bis not\b/g, "isn't"], [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"], [/\bwere not\b/g, "weren't"], [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"], [/\bdid not\b/g, "didn't"], [/\bhave not\b/g, "haven't"],
  [/\bhas not\b/g, "hasn't"], [/\bhad not\b/g, "hadn't"], [/\bwill not\b/g, "won't"],
  [/\bwould not\b/g, "wouldn't"], [/\bshould not\b/g, "shouldn't"], [/\bcould not\b/g, "couldn't"],
  [/\bi am\b/g, "i'm"], [/\bit is\b/g, "it's"], [/\bthat is\b/g, "that's"],
  [/\bthere is\b/g, "there's"], [/\bwhat is\b/g, "what's"], [/\bhe is\b/g, "he's"],
  [/\bshe is\b/g, "she's"], [/\bthey are\b/g, "they're"], [/\bwe are\b/g, "we're"],
  [/\byou are\b/g, "you're"], [/\bi have\b/g, "i've"], [/\bi will\b/g, "i'll"],
  [/\bi would\b/g, "i'd"], [/\blet us\b/g, "let's"],
];

function canonicalSentence(value) {
  let s = String(value || "").toLowerCase().replace(/[‘’ʼ]/g, "'");
  for (const [re, to] of CONTRACTIONS) s = s.replace(re, to);
  return s.replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
}

const isRealCorrection = (f) =>
  f.original && f.corrected && canonicalSentence(f.original) !== canonicalSentence(f.corrected);

// Coerces whatever the model returned into a guaranteed, bounded shape so the
// frontend never sees a malformed analysis, even on a partial response.
function normalizeAnalysis(raw, { analyzeSeconds, transcript }) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const clampScore = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  };
  const asStr = (v) => (typeof v === "string" ? v.trim() : "");
  const strList = (v, max) => (Array.isArray(v) ? v : []).map(asStr).filter(Boolean).slice(0, max);

  const rawFeedback = (Array.isArray(obj.feedback) ? obj.feedback : [])
    .map((f) => ({ original: asStr(f?.original), corrected: asStr(f?.corrected), reason: asStr(f?.reason) }));
  const feedback = rawFeedback.filter(isRealCorrection).slice(0, 5);
  const dropped = rawFeedback.length - feedback.length;
  if (dropped > 0) console.log("[Analysis] dropped", dropped, "non-corrections (style-only rewrites)");

  const scores = obj.scores && typeof obj.scores === "object" ? obj.scores : {};
  const fluency = clampScore(scores.fluency);
  const grammar = clampScore(scores.grammar);
  const vocabScore = clampScore(scores.vocabulary);

  const vocabulary = (Array.isArray(obj.vocabulary) ? obj.vocabulary : [])
    .map((v) => ({ word: asStr(v?.word), example: asStr(v?.example) }))
    .filter((v) => v.word).slice(0, 4);

  return {
    recap: asStr(obj.recap) || "Söhbətiniz analiz olundu.",
    // Derived, not asked of the model: one less field to hallucinate, and it can
    // never contradict the three scores it is supposed to summarise.
    overallScore: Math.round((fluency + grammar + vocabScore) / 3),
    scores: { fluency, grammar, vocabulary: vocabScore },
    feedback,
    strengths: strList(obj.strengths, 2),
    tips: strList(obj.tips, 3),
    vocabulary,
    speakingPace: computeSpeakingPace(transcript, analyzeSeconds),
  };
}

// Groq chat with strict JSON, in-call retries (max 3) and a schema→json_object
// fallback, so json_validate_failed and malformed output self-heal instead of
// failing the ticket permanently.
// Escalating completion budgets: the observed production failure was
// "max completion tokens reached before generating a valid document" — the
// answer was cut mid-JSON, so retrying with the same budget can never succeed.
// A full answer under ANALYSIS_SCHEMA's maxItems is ~600 tokens, so the first
// attempt has ample headroom; the ladder exists only for the rare overrun.
const ANALYSIS_MAX_TOKENS = [1200, 1700, 2200];

async function callGroqChat(userContent) {
  const messages = [{ role: "user", content: userContent }];
  let useSchema = true;
  let lastErr = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY.value()}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0,
        top_p: 1,
        seed: 7,
        max_tokens: ANALYSIS_MAX_TOKENS[attempt - 1],
        response_format: useSchema
          ? { type: "json_schema", json_schema: { name: "speech_analysis", strict: true, schema: ANALYSIS_SCHEMA } }
          : { type: "json_object" },
      }),
    }, GROQ_CHAT_TIMEOUT_MS, "Groq chat");

    if (!res.ok) {
      const errText = (await res.text().catch(() => "")).slice(0, 400);
      // Model/endpoint rejects json_schema → drop to json_object and retry.
      if (useSchema && /json_schema|response_format|not supported/i.test(errText)) {
        useSchema = false;
        continue;
      }
      // Answer was truncated mid-JSON → next attempt gets a bigger budget and
      // an explicit order to shrink the arrays.
      if (/max completion tokens|max_tokens/i.test(errText)) {
        messages.push({ role: "system", content: "Cavab çox uzun idi və kəsildi. Massivləri qısalt: grammarFixes ən çox 3, vocabularyUsed ən çox 5, vocabularySuggestions ən çox 3, exampleSentences 2. İzahlar 8 sözdən uzun olmasın." });
        lastErr = Object.assign(new Error("json_truncated"), { retryable: true });
        continue;
      }
      // Model produced invalid JSON → nudge and retry.
      if (/json_validate_failed/i.test(errText)) {
        messages.push({ role: "system", content: "Əvvəlki cavab keçərli JSON deyildi. YALNIZ keçərli JSON obyekti qaytar, başqa heç nə yazma." });
        lastErr = Object.assign(new Error("json_validate_failed"), { retryable: true });
        continue;
      }
      // Rate limit / server error → let the queue retry on the next tick.
      throw Object.assign(new Error("Groq LLM error " + res.status + ": " + errText), {
        retryable: isRetryableStatus(res.status),
      });
    }

    const rawText = (await res.json()).choices?.[0]?.message?.content;
    try {
      return parseJsonLoose(rawText);
    } catch (e) {
      messages.push({ role: "system", content: "Əvvəlki cavab keçərli JSON deyildi. YALNIZ keçərli JSON obyekti qaytar, başqa heç nə yazma." });
      lastErr = Object.assign(new Error("json_parse_failed: " + e.message), { retryable: true });
    }
  }

  throw lastErr || Object.assign(new Error("Groq JSON failed after retries"), { retryable: true });
}

// Only the first 5 minutes of a call are analyzed. A byte-prefix of a WebM is
// still decodable, so this is a contiguous, real 5-minute recording — not a
// stitched sample. Shorter calls are analyzed in full. Capping here (rather
// than at a fraction of the call) keeps the per-ticket cost constant, which is
// what makes the queue drain predictably on the free Groq audio budget.
const ANALYSIS_MAX_SECONDS = 300;

function effectiveAnalyzeSeconds(audioSeconds) {
  if (!audioSeconds) return 0;
  return Math.min(audioSeconds, ANALYSIS_MAX_SECONDS);
}

// Data-only push to one user's device (the messaging SW displays it and
// routes clicks via data.url); prunes dead tokens. Data-only avoids the
// SDK double-display problem that notification payloads can cause.
async function sendPushToUser(db, uid, { title, body, type, url }) {
  const userSnap = await db.collection("users").doc(uid).get();
  const data = userSnap.exists ? userSnap.data() : {};
  const entries = await getTokensForUser(db, uid, data.fcmToken, data.fcmTokenFailCount);
  if (!entries.length) return;
  try {
    await sendPush(entries, { title, body, type, url });
  } catch (error) {
    console.warn("[Push] send failed:", uid, error.message);
  }
}

// Transactionally flips one pending ticket to processing if the hourly
// audio budget allows it. Returns the ticket data or null when skipped.
async function claimTicket(db, ticketRef) {
  const budgetRef = db.collection("analysisBudget").doc("current");
  return db.runTransaction(async (tx) => {
    const ticketSnap = await tx.get(ticketRef);
    if (!ticketSnap.exists || ticketSnap.data().status !== "pending") return null;
    const ticket = ticketSnap.data();

    const budgetSnap = await tx.get(budgetRef);
    const now = Date.now();
    let windowStart = now;
    let used = 0;
    if (budgetSnap.exists) {
      const b = budgetSnap.data();
      const startMs = b.windowStart ? b.windowStart.toMillis() : 0;
      if (now - startMs < 60 * 60 * 1000) {
        windowStart = startMs;
        used = b.usedAudioSeconds || 0;
      }
    }
    const analyzeSeconds = effectiveAnalyzeSeconds(ticket.audioSeconds || 0);
    // Budget counts attempts (no refund on retry) — deliberately conservative.
    if (used + analyzeSeconds > ANALYSIS_HOURLY_AUDIO_BUDGET) return null;

    tx.set(budgetRef, {
      windowStart: admin.firestore.Timestamp.fromMillis(windowStart),
      usedAudioSeconds: used + analyzeSeconds,
    });
    tx.update(ticketRef, {
      status: "processing",
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ticketSnap.id, ref: ticketRef, analyzeSeconds, ...ticket };
  });
}

// Retires a ticket for good: mark it failed, tell the user's callAnalysis doc,
// and drop the recording so a dead ticket never keeps costing storage.
async function failTicket(db, ticketRef, ticketId, ticketData, retryCount, message) {
  const text = String(message);
  await ticketRef.update({
    status: "failed",
    retryCount,
    lastError: text.slice(0, 500),
  });
  await db.collection("callAnalysis").doc(ticketId).set({
    status: "failed",
    error: text.slice(0, 300),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    userId: ticketData.uid,
    // Without these the History row renders as "Anonim / Naməlum".
    peerName: ticketData.peerName || null,
    durationSeconds: ticketData.audioSeconds || 0,
  }, { merge: true });
  if (ticketData.storagePath) {
    await admin.storage().bucket().file(ticketData.storagePath).delete().catch(() => null);
  }
  console.error("[AnalysisQueue] Failed permanently:", ticketId, text);

  // Silence is the worst outcome: without this the user waits for a result that
  // is never coming, because History only ever showed finished analyses.
  const noSpeech = text.startsWith("no-speech");
  await sendPushToUser(db, ticketData.uid, {
    title: "Analiz alınmadı",
    body: noSpeech
      ? "Danışıq eşidilmədi — mikrofonu yoxlayıb yenidən cəhd et."
      : "Zəngin analizi tamamlana bilmədi. Növbəti zəngdə yenidən cəhd edəcəyik.",
    type: "analysis_failed",
    url: "/history",
  });
}

async function runGroqAnalysis(audioBuffer, analyzeSeconds, ext = "webm") {
  const mime = ext === "mp4" ? "audio/mp4" : "audio/webm";
  const blob = new Blob([audioBuffer], { type: mime });
  const groqForm = new FormData();
  groqForm.append("file", blob, `audio.${ext}`);
  groqForm.append("model", "whisper-large-v3-turbo");
  groqForm.append("response_format", "json");

  const whisperRes = await fetchWithTimeout("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_API_KEY.value()}` },
    body: groqForm,
  }, GROQ_WHISPER_TIMEOUT_MS, "Groq Whisper");
  if (!whisperRes.ok) {
    const err = new Error("Groq Whisper error: " + (await whisperRes.text()).slice(0, 300));
    err.retryable = isRetryableStatus(whisperRes.status);
    throw err;
  }
  const transcript = (await whisperRes.json()).text;
  if (!transcript || !transcript.trim()) {
    const err = new Error("no-speech: could not hear any speech in the audio");
    err.retryable = false;
    throw err;
  }

  // 2. Analysis via Groq LLM — strict JSON schema, self-healing retries.
  const promptTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : transcript;
  const raw = await callGroqChat(ANALYSIS_PROMPT.replace("{{TRANSCRIPT}}", promptTranscript));
  const analysis = normalizeAnalysis(raw, { analyzeSeconds, transcript });
  return { transcript, analysis };
}

exports.processAnalysisQueue = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Baku",
  secrets: [GROQ_API_KEY],
  memory: "1GiB",
  timeoutSeconds: 540,
}, async () => {
  const db = admin.firestore();
  const queue = db.collection("analysisQueue");
  const invocationStart = Date.now();

  // Recover tickets stuck in processing (worker crash / timeout).
  const processingSnap = await queue.where("status", "==", "processing").get();
  const stuckCutoff = Date.now() - ANALYSIS_STUCK_MS;
  for (const docSnap of processingSnap.docs) {
    const data = docSnap.data();
    const startedMs = data.processingStartedAt ? data.processingStartedAt.toMillis() : 0;
    if (startedMs >= stuckCutoff) continue;

    // Resetting a stuck ticket without counting the attempt let a ticket that
    // always hangs cycle forever — and claimTicket charges the hourly audio
    // budget on every cycle, so a handful of them starved the whole queue.
    const retryCount = (data.retryCount || 0) + 1;
    if (retryCount >= ANALYSIS_MAX_RETRIES) {
      await failTicket(db, docSnap.ref, docSnap.id, data, retryCount,
        "stuck: worker timed out repeatedly");
    } else {
      await docSnap.ref.update({
        status: "pending",
        retryCount,
        lastError: "stuck: reset after worker timeout",
      });
      console.warn("[AnalysisQueue] Reset stuck ticket:", docSnap.id, "retryCount:", retryCount);
    }
  }

  // Queue depth is the backlog metric; exit early when there is nothing to do.
  const depth = (await queue.where("status", "==", "pending").count().get()).data().count;
  console.log("[AnalysisQueue] Pending depth:", depth, "processing:", processingSnap.size);
  if (depth === 0) return;

  const pendingSnap = await queue
    .where("status", "==", "pending")
    .orderBy("createdAt", "asc")
    .limit(ANALYSIS_CLAIM_LIMIT)
    .get();

  for (const docSnap of pendingSnap.docs) {
    // Never start a ticket we cannot finish: an invocation killed at 540s
    // leaves its ticket wedged in "processing" for the next ten minutes.
    if (Date.now() - invocationStart > ANALYSIS_INVOCATION_BUDGET_MS) {
      console.log("[AnalysisQueue] Deadline reached, leaving the rest for the next tick");
      break;
    }

    const ticket = await claimTicket(db, docSnap.ref);
    if (!ticket) {
      console.log("[AnalysisQueue] Skipped (budget or already claimed):", docSnap.id);
      continue;
    }

    const analysisRef = db.collection("callAnalysis").doc(ticket.id);
    try {
      await analysisRef.set({ status: "processing" }, { merge: true });

      let audioBuffer;
      try {
        [audioBuffer] = await admin.storage().bucket().file(ticket.storagePath).download();
      } catch (downloadError) {
        // A recording that is not there will never appear; retrying only burns
        // three more slices of the hourly audio budget.
        if (downloadError.code === 404) {
          throw Object.assign(new Error("recording-missing: " + ticket.storagePath), { retryable: false });
        }
        throw downloadError;
      }

      // Partial analysis: a WebM byte-prefix stays decodable (header is at
      // the start; Opus speech is ~constant bitrate, so bytes ≈ time).
      const totalSeconds = ticket.audioSeconds || 0;
      const analyzeSeconds = ticket.analyzeSeconds || totalSeconds;
      let analysisBuffer = audioBuffer;
      if (totalSeconds > 0 && analyzeSeconds < totalSeconds) {
        analysisBuffer = audioBuffer.subarray(
          0, Math.ceil(audioBuffer.length * (analyzeSeconds / totalSeconds)));
      }

      const ext = (ticket.storagePath || "").includes(".mp4") ? "mp4" : "webm";
      const { transcript, analysis } = await runGroqAnalysis(analysisBuffer, analyzeSeconds, ext);

      await analysisRef.set({
        ...analysis,
        transcript,
        status: "done",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: ticket.uid,
        peerName: ticket.peerName || null,
        durationSeconds: ticket.audioSeconds || 0,
        analyzedSeconds: analyzeSeconds,
      }, { merge: true });
      await ticket.ref.update({
        status: "done",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await admin.storage().bucket().file(ticket.storagePath).delete().catch(() => null);
      console.log("[AnalysisQueue] Done:", ticket.id);

      await sendPushToUser(db, ticket.uid, {
        title: "Analiziniz hazırdır 🎓",
        body: "Zəng analizin hazır oldu — nəticəyə bax!",
        type: "analysis_ready",
        url: "/history",
      });
    } catch (error) {
      const retryCount = (ticket.retryCount || 0) + 1;
      const retryable = error.retryable !== false && retryCount < ANALYSIS_MAX_RETRIES;
      console.error("[AnalysisQueue] Failed:", ticket.id, "retryable:", retryable, error.message);
      if (retryable) {
        await ticket.ref.update({
          status: "pending",
          retryCount,
          lastError: String(error.message).slice(0, 500),
        });
      } else {
        await failTicket(db, ticket.ref, ticket.id, ticket, retryCount, error.message);
      }
    }
  }
});

// ─── Scheduled Session Matchmaking ─────────────────────────────────
// Pairs everyone who joined the evening session (matchQueue docs with
// status "waiting_session") in ONE server-side pass when the buffer window
// closes — no client fan-out, no client transactions. Runs every minute but
// only acts once per session (guarded by sessionRuns/{sessionId}).
const SESSION_LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

function sessionLevelRank(level) {
  const match = String(level || "").match(/^(A1|A2|B1|B2|C1|C2)\b/);
  return match ? SESSION_LEVEL_RANK[match[1]] : null;
}

function sessionPairScore(a, b) {
  const rankA = sessionLevelRank(a.level);
  const rankB = sessionLevelRank(b.level);
  const distance = (rankA !== null && rankB !== null) ? Math.abs(rankA - rankB) : 3;
  let score = Math.max(0, 50 - distance * 15);

  const topicsA = Array.isArray(a.topics) ? a.topics : [];
  const topicsB = Array.isArray(b.topics) ? b.topics : [];
  score += topicsA.filter((t) => topicsB.includes(t)).length * 10;

  if (a.partnerPreference === "Same" && distance === 0) score += 10;
  if (b.partnerPreference === "Same" && distance === 0) score += 10;
  if (a.partnerPreference === "Higher" && rankB !== null && rankA !== null && rankB > rankA) score += 10;
  if (b.partnerPreference === "Higher" && rankA !== null && rankB !== null && rankA > rankB) score += 10;
  return score;
}

// Email fallback for the 15-min reminder: web push is unreliable on mobile
// (especially uninstalled iOS), so email makes sure people still show up. Only
// recently-active users are mailed to keep volume under Gmail's limits and
// protect sender reputation.
const EMAIL_ACTIVE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const EMAIL_BCC_BATCH = 50;

async function sendSessionEmails(db, startLabel, hour) {
  const gmailUser = GMAIL_USER.value();
  const gmailPass = GMAIL_APP_PASSWORD.value();
  if (!gmailUser || !gmailPass) {
    console.warn("[SessionEmail] Gmail secrets not set — skipping email reminder");
    return;
  }

  const usersSnap = await db.collection("users").get();
  const cutoff = Date.now() - EMAIL_ACTIVE_WINDOW_MS;
  const seen = new Set();
  const recipients = [];
  for (const d of usersSnap.docs) {
    const u = d.data() || {};
    const email = typeof u.email === "string" ? u.email.trim() : "";
    const lastSeen = u.lastSeen && u.lastSeen.toMillis ? u.lastSeen.toMillis() : 0;
    if (!email || !email.includes("@")) continue;
    if (lastSeen < cutoff) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(email);
  }
  if (recipients.length === 0) {
    console.log("[SessionEmail] no recently-active recipients");
    return;
  }

  const isDay = hour < 18;
  const subject = isDay
    ? "☀️ Günorta sessiyasına 15 dəqiqə qaldı!"
    : "🌙 Axşam sessiyasına 15 dəqiqə qaldı!";
  const appUrl = APP_URL.value();
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e">
      <h2 style="margin:0 0 12px">🎙️ SpeakLab sessiyası ${startLabel}-da başlayır</h2>
      <p style="font-size:15px;line-height:1.5;color:#444;margin:0 0 20px">
        Sessiyaya <b>15 dəqiqə</b> qaldı. Danışıq təcrübəsi üçün tətbiqə daxil ol və növbəyə qoşul —
        rəqib tapılan kimi zəng avtomatik başlayacaq.
      </p>
      <a href="${appUrl}" style="display:inline-block;background:#7c6ff7;color:#fff;text-decoration:none;
        padding:12px 24px;border-radius:10px;font-weight:700">Tətbiqi aç →</a>
    </div>`;

  const textBody = `SpeakLab sessiyası ${startLabel}-da başlayır!\n\nSessiyaya 15 dəqiqə qaldı. Danışıq təcrübəsi üçün tətbiqə daxil ol və növbəyə qoşul.\n\nTətbiqi aç: ${appUrl}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  let sent = 0;
  const CHUNK_SIZE = 10; // Send 10 emails concurrently to respect Gmail connection limits
  
  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const batch = recipients.slice(i, i + CHUNK_SIZE);
    await Promise.all(batch.map(async (email) => {
      try {
        await transporter.sendMail({
          from: `"SpeakLab" <${gmailUser}>`,
          to: email,
          subject,
          text: textBody,
          html,
        });
        sent++;
      } catch (e) {
        console.error("[SessionEmail] failed for", email, e.message);
      }
    }));
  }
  console.log("[SessionEmail] sent:", sent, "of", recipients.length);
}

// One reminder push to every registered device, 15 min before the session.
// The wording follows the session's time of day.
async function broadcastSessionReminder(db, startLabel, hour) {
  const title = hour < 18
    ? "Günorta sessiyasına az qaldı! ☀️"
    : "Axşam sessiyasına az qaldı! 🌙";

  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((d) => ({ ref: d.ref, fcmToken: d.data().fcmToken, fcmTokenFailCount: d.data().fcmTokenFailCount }));
  const tokenEntries = await getAllTokens(db, users);

  const { sent, removed } = await sendPush(tokenEntries, {
    title,
    body: `Sessiya ${startLabel}-da başlayır — günün mövzusuna bax və hazır ol.`,
    type: "session_reminder",
    url: "/",
  });
  console.log("[SessionMatch] reminder sent:", sent, "invalidTokensRemoved:", removed);
}

// Same normalisation as the client (src/utils/sessionSchedule.js): a non-empty
// `sessions` array wins, else the two standard daily sessions. Legacy single
// hour/minute configs are intentionally upgraded to the two-session default.
const DEFAULT_SESSION_TIMES = [{ hour: 16, minute: 0 }, { hour: 21, minute: 0 }];
function getSessionTimes(cfg) {
  const list = Array.isArray(cfg?.sessions) && cfg.sessions.length ? cfg.sessions : DEFAULT_SESSION_TIMES;
  return list
    .filter((s) => Number.isFinite(s?.hour))
    .map((s) => ({ hour: s.hour, minute: s.minute || 0 }))
    .sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
}

// Pair everyone parked for one session. Called on every tick while the window
// is open (greedy: whoever is waiting gets matched at once). `final` is set on
// the closing sweep, where the last unmatched waiter is settled with a bonus;
// mid-window, leftovers are left in the queue to keep waiting for a partner.
async function matchSessionWaiters(db, sessionId, final) {
  // New clients join sessions as "searching" (shared instant pool, paired
  // client-side within seconds); "waiting_session" is kept for old clients
  // still on the parked-ticket flow. This cron pass is now just the fallback
  // pairer and the close-of-window settler.
  const waitingSnap = await db.collection("matchQueue")
    .where("status", "in", ["searching", "waiting_session"])
    .where("sessionId", "==", sessionId)
    .get();
  const allWaiting = waitingSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  // Ghost filter: skip waiters whose liveness ping went stale (closed the
  // app after joining) so nobody gets paired into a dead call. No bonus —
  // they left on their own.
  const staleCutoff = Date.now() - 4 * 60 * 1000;
  const users = [];
  const ghosts = [];
  for (const u of allWaiting) {
    const lastPing = u.lastPingMs || u.joinedAtMs || 0;
    (lastPing < staleCutoff ? ghosts : users).push(u);
  }
  console.log("[SessionMatch]", sessionId, "joined:", allWaiting.length, "ghosts:", ghosts.length);
  if (users.length === 0 && ghosts.length === 0) return;

  // Greedy pairing: earliest joiner picks the best-scoring remaining partner.
  users.sort((a, b) => (a.joinedAtMs || 0) - (b.joinedAtMs || 0));
  const pairs = [];
  const remaining = [...users];
  while (remaining.length >= 2) {
    const current = remaining.shift();
    let bestIdx = 0;
    let bestScore = -1;
    remaining.forEach((cand, idx) => {
      const score = sessionPairScore(current, cand);
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    });
    pairs.push([current, remaining.splice(bestIdx, 1)[0]]);
  }
  const leftover = remaining;

  // Clients now pair this same pool concurrently, so every pair must be
  // committed through a transaction that re-verifies both tickets. A blind
  // batch write could split a pair the clients had already committed between
  // our read and our write (overwriting matchedWith with a different partner
  // and sending two people into calls where nobody shows up).
  const MATCHABLE_STATUSES = ["searching", "waiting_session"];
  let committedPairs = 0;
  for (const [a, b] of pairs) {
    const callId = `call_${[a.uid, b.uid].sort().join("_")}`;
    try {
      await db.runTransaction(async (tx) => {
        const [aSnap, bSnap] = await Promise.all([tx.get(a.ref), tx.get(b.ref)]);
        if (!aSnap.exists || !MATCHABLE_STATUSES.includes(aSnap.data().status)) {
          throw new Error("a-already-taken");
        }
        if (!bSnap.exists || !MATCHABLE_STATUSES.includes(bSnap.data().status)) {
          throw new Error("b-already-taken");
        }
        tx.set(db.collection("calls").doc(callId), {
          userA: a.uid,
          userB: b.uid,
          callerId: a.uid,
          callerName: a.name || "User",
          receiverId: b.uid,
          receiverName: b.name || "User",
          status: "accepted",
          source: "session_match",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.update(a.ref, {
          status: "matched", matchedWith: b.uid, callId,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.update(b.ref, {
          status: "matched", matchedWith: a.uid, callId,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      committedPairs++;
    } catch (e) {
      // A client transaction won the ticket first — their pairing stands.
      console.log("[SessionMatch] pair skipped:", a.uid, b.uid, e.message);
    }
  }

  // Settlement writes are per-doc with individual failure tolerance: a ticket
  // deleted mid-sweep (its owner just matched or left) must not abort the
  // consolation for everyone else, which a shared batch would do.
  // Mid-window, an unpaired waiter stays in the queue for the next tick; only
  // the closing sweep settles them as unmatched with a consolation bonus.
  if (final) {
    for (const u of leftover) {
      try {
        await u.ref.update({ status: "unmatched" });
        await db.collection("users").doc(u.uid).set({
          bonusMinutes: admin.firestore.FieldValue.increment(5),
        }, { merge: true });
      } catch (e) { /* ticket gone — matched or left on their own */ }
    }
  }
  for (const u of ghosts) {
    await u.ref.update({ status: "unmatched", ghost: true }).catch(() => null);
  }

  console.log("[SessionMatch] pairs:", committedPairs, "of", pairs.length, "unmatched:", leftover.length);
}

exports.matchSessionQueue = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Baku",
  secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
}, async () => {
  const db = admin.firestore();

  const cfgSnap = await db.collection("appConfig").doc("session").get();
  if (!cfgSnap.exists || !cfgSnap.data().enabled) return;
  const cfg = cfgSnap.data();
  const bufferMs = (Number.isFinite(cfg.bufferMinutes) ? cfg.bufferMinutes : 10) * 60 * 1000;

  const pad = (n) => String(n).padStart(2, "0");
  const bakuDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());
  const now = Date.now();

  // Each session runs its own reminder and matching pass. The times never
  // overlap, so evaluating every session each tick does no redundant work.
  for (const t of getSessionTimes(cfg)) {
    const sessionId = `${bakuDate}-${pad(t.hour)}`;
    const startMs = Date.parse(`${bakuDate}T${pad(t.hour)}:${pad(t.minute)}:00+04:00`);
    const endMs = startMs + bufferMs;

    // Reminder window: 15 min before start, sent once (guarded by marker doc).
    if (now >= startMs - 15 * 60 * 1000 && now < startMs) {
      const remRef = db.collection("sessionRuns").doc(`${sessionId}_reminder`);
      const remClaimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(remRef);
        if (snap.exists) return false;
        tx.set(remRef, { sentAt: admin.firestore.FieldValue.serverTimestamp() });
        return true;
      });
      if (remClaimed) {
        const startLabel = `${pad(t.hour)}:${pad(t.minute)}`;
        await broadcastSessionReminder(db, startLabel, t.hour);
        await sendSessionEmails(db, startLabel, t.hour);
      }
      continue;
    }

    // Greedy matching while the window is open: pair whoever is waiting right
    // now, every tick, so a second joiner is matched within a minute instead of
    // waiting for the buffer to close. Leftovers stay queued for the next tick.
    if (now >= startMs && now < endMs) {
      await matchSessionWaiters(db, sessionId, false);
      continue;
    }

    // Closing sweep: once the buffer closes, claim the run once and settle any
    // remaining waiter (unmatched + consolation bonus).
    if (now < endMs) continue;

    const runRef = db.collection("sessionRuns").doc(sessionId);
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(runRef);
      if (snap.exists) return false;
      tx.set(runRef, { startedAt: admin.firestore.FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) continue;

    try {
      await matchSessionWaiters(db, sessionId, true);
    } catch (error) {
      // Release the run marker so the next tick can retry this session's pass.
      await runRef.delete().catch(() => null);
      throw error;
    }
  }
});

// ─── "Someone is looking for a partner" push ───────────────────────
// With a small user base the bottleneck is not the matching algorithm, it is
// that two people are rarely searching at the same minute. When somebody joins
// the on-demand queue and nobody else is in it, nudge the users who are online
// and free. Guarded by a global cooldown so this can never become a spam loop.
const SEARCH_PING_COOLDOWN_MS = 10 * 60 * 1000;
const SEARCH_PING_MAX_RECIPIENTS = 30;
const PRESENCE_FRESH_MS = 5 * 60 * 1000;

exports.notifySearchingUser = onDocumentWritten("matchQueue/{uid}", async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;

  // Only the moment a ticket *becomes* an on-demand search. Liveness pings and
  // the scheduled-session tickets must not re-trigger this.
  if (!after || after.status !== "searching") return;
  if (before && before.status === "searching") return;

  const db = admin.firestore();
  const searcherUid = event.params.uid;

  // If someone else is already searching, the two will pair on their own.
  const others = await db.collection("matchQueue")
    .where("status", "==", "searching")
    .limit(2)
    .get();
  if (others.docs.some((d) => d.id !== searcherUid)) {
    console.log("[SearchPing] another searcher present, skipping");
    return;
  }

  // Global cooldown, claimed transactionally so concurrent joins send once.
  const cooldownRef = db.collection("pushCooldown").doc("searchPing");
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(cooldownRef);
    const lastMs = snap.exists ? (snap.data().lastSentMs || 0) : 0;
    if (Date.now() - lastMs < SEARCH_PING_COOLDOWN_MS) return false;
    tx.set(cooldownRef, { lastSentMs: Date.now() });
    return true;
  });
  if (!claimed) {
    console.log("[SearchPing] within cooldown, skipping");
    return;
  }

  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - PRESENCE_FRESH_MS);
  const onlineSnap = await db.collection("users")
    .where("lastSeen", ">", cutoff)
    .limit(SEARCH_PING_MAX_RECIPIENTS * 2)
    .get();

  // Gather up to SEARCH_PING_MAX_RECIPIENTS candidate devices — each free,
  // online user contributes all of their device tokens.
  const recipients = [];
  for (const docSnap of onlineSnap.docs) {
    if (docSnap.id === searcherUid) continue;
    const data = docSnap.data();
    if (data.status === "busy") continue; // already in a call
    const entries = await getTokensForUser(db, docSnap.id, data.fcmToken, data.fcmTokenFailCount);
    for (const e of entries) {
      recipients.push(e);
      if (recipients.length >= SEARCH_PING_MAX_RECIPIENTS) break;
    }
    if (recipients.length >= SEARCH_PING_MAX_RECIPIENTS) break;
  }

  const searcherName = String(after.name || "Kimsə").slice(0, 30);
  const { sent } = await sendPush(recipients, {
    title: "Kimsə praktika axtarır 🎙️",
    body: `${searcherName} partnyor gözləyir — indi qoşul!`,
    type: "search_ping",
    url: "/",
  });
  console.log("[SearchPing] candidates:", recipients.length, "sent:", sent);
});

// ─── Hesab Silmə (Google Play tələbi: hesab + data silmə) ──────
// Deletes every piece of data a single user owns, anonymises their name in
// shared call/chat records, then removes the Firebase Auth account. Data is
// removed *before* the auth account so that a partial failure leaves the
// account intact and the user can safely retry rather than being locked out of
// a half-deleted account.
const DELETED_LABEL = "Silinmiş istifadəçi";

// Deletes every doc a query returns, 400 at a time (Firestore batch cap 500).
async function deleteByQuery(query) {
  let removed = 0;
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = admin.firestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    removed += snap.size;
    if (snap.size < 400) break;
  }
  return removed;
}

// Recursively deletes a doc together with any known sub-collections.
async function deleteDocDeep(ref, subcollections = []) {
  for (const name of subcollections) {
    await deleteByQuery(ref.collection(name));
  }
  await ref.delete().catch(() => null);
}

exports.deleteAccount = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const uid = decoded.uid;
  const db = admin.firestore();

  try {
    // 1) Owned documents (+ their sub-collections).
    await deleteDocDeep(db.collection("users").doc(uid), ["fcmTokens"]);
    await deleteDocDeep(db.collection("wordHistory").doc(uid), ["words"]);
    await db.collection("matchQueue").doc(uid).delete().catch(() => null);
    await db.collection("premiumRequests").doc(uid).delete().catch(() => null);

    // 2) Owned collections keyed by a uid field.
    await deleteByQuery(db.collection("callAnalysis").where("userId", "==", uid));
    await deleteByQuery(db.collection("analysisQueue").where("uid", "==", uid));

    // 3) Stored call recordings (Storage), best-effort.
    await admin.storage().bucket()
      .deleteFiles({ prefix: `callRecordings/${uid}/` })
      .catch((e) => console.warn("[deleteAccount] storage cleanup failed:", e.message));

    // 4) Anonymise the user's name in shared call/chat records (best-effort —
    //    these docs belong to a conversation with another person, so we keep the
    //    record but strip this user's identity from it).
    try {
      for (const field of ["callerId", "userA"]) {
        const snap = await db.collection("calls").where(field, "==", uid).limit(400).get();
        await Promise.all(snap.docs.map((d) =>
          d.ref.update({ callerName: DELETED_LABEL }).catch(() => null)));
      }
      for (const field of ["receiverId", "userB"]) {
        const snap = await db.collection("calls").where(field, "==", uid).limit(400).get();
        await Promise.all(snap.docs.map((d) =>
          d.ref.update({ receiverName: DELETED_LABEL }).catch(() => null)));
      }
      const chats = await db.collection("chats").where("participants", "array-contains", uid).limit(200).get();
      for (const chat of chats.docs) {
        const msgs = await chat.ref.collection("messages").where("senderId", "==", uid).limit(400).get();
        await Promise.all(msgs.docs.map((d) =>
          d.ref.update({ senderName: DELETED_LABEL }).catch(() => null)));
      }
    } catch (e) {
      console.warn("[deleteAccount] anonymisation partial failure:", e.message);
    }

    // 5) Finally the auth account itself.
    await admin.auth().deleteUser(uid);

    console.log("[deleteAccount] completed for", uid);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[deleteAccount] failed for", uid, e);
    res.status(500).json({ error: "Silinmə tamamlanmadı. Yenidən cəhd edin." });
  }
});

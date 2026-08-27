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
const {
  pushText,
  pushLang,
  slotTimeLabel,
  hourOnlyLabel,
} = require("./pushText");

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

// Groq retires model names without notice. llama-3.3-70b-versatile began
// returning model_not_found on this account, which silently broke generateQuiz
// and left callAnalysisLLM with a fallback that could never fire. The id lives
// in one place now. aiActivityTurn goes further and walks a list at runtime
// (AI_TURN_MODELS) so it survives the next retirement on its own.
const GROQ_CHAT_MODEL = "openai/gpt-oss-20b";

const ADMIN_UID = "6Djehd9KB8dTZUgVwVJfLoPI5dF3";
// Ops xəbərdarlıqlarının getdiyi əsas qutu (ADMIN_UID sənədindəki e-poçt
// başqa hesaba aiddir, ona görə açıq yazılır).
const OPS_ALERT_EMAIL = "poladagayev90@gmail.com";

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
const TRIAL_DAYS = 60;             // kodsuz trial: ilk girişdən 2 ay
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
// yoxsa dəyişdirilmiş client mode:'course' qoyub TRIAL_DAYS limitini keçərdi.
// (Kurs istifadəçiləri redeemCode-da isPremium:true alır, ona görə müstəsnadır.)
// trialStartedAt olmayan köhnə userlər də bloklanmır.
function isTrialExpired(u, uid) {
  if (!u) return false;
  // Sahibin hesabı heç vaxt bloklanmır — users sənədindəki isPremium
  // bayrağından asılı olmadan. Client tərəfdəki getTrialDaysLeft eyni
  // istisnanı daşıyır; ikisi birlikdə dəyişməlidir.
  if (uid === ADMIN_UID) return false;
  // Kohorta müraciəti gözlənilən user bloklanmır. Təhlükəsizdir, çünki
  // firestore.rules cohortStatus-u client yazısından qoruyur — bu vəziyyətə
  // yalnız redeemCode (etibarlı kodla) və admin sala bilər.
  if (u.cohortStatus === "pending" || u.cohortStatus === "accepted") return false;
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

  // Kodsuz trial TRIAL_DAYS gündən sonra zəngi serverdə bloklayır — token verilmir.
  const uDoc = await admin.firestore().collection("users").doc(decoded.uid).get().catch(() => null);
  if (isTrialExpired(uDoc && uDoc.exists ? uDoc.data() : null, decoded.uid)) {
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

  // Blok: qəbul edən bu zəng edəni bloklayıbsa, push ümumiyyətlə göndərilmir
  // (client onsuz da modalı göstərmir — bu, cihaz bildirişini də kəsir).
  const blockSnap = await db.collection("users").doc(receiverId)
    .collection("blocked").doc(callerId).get().catch(() => null);
  if (blockSnap && blockSnap.exists) {
    return res.status(200).json({ ok: true, blocked: true });
  }

  const callerSnap = await db.collection("users").doc(callerId).get().catch(() => null);
  const rawName = (callerSnap && callerSnap.exists ? callerSnap.data().name : "") || "Someone";
  const callerName = String(rawName).slice(0, 40);

  await sendPushToUser(db, receiverId, {
    key: "incoming_call",
    vars: { callerName },
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
    key: "premium_activated",
    vars: { userName },
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
  // Müəllimlər gündəlik mövzu xatırlatmalarını ALMIR: onlar tətbiqi məşq üçün
  // deyil, şagird izləmək üçün açırlar — gündə 3 push spam kimi qəbul olunurdu.
  // Müəllimə gedən yeganə bildiriş: "şagirdinizin analizi hazırdır".
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs
    .filter((d) => d.data().role !== "teacher")
    .map(d => ({ ref: d.ref, fcmToken: d.data().fcmToken, fcmTokenFailCount: d.data().fcmTokenFailCount }));
  const tokenEntries = await getAllTokens(db, users);
  // The user documents are already in memory, so the language map costs no
  // extra read; sendPushByLang then sends one multicast per language.
  const langByUid = new Map(usersSnap.docs.map((d) => [d.id, pushLang(d.data())]));

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
  const { sent, removed } = await sendPushByLang(
    tokenEntries,
    (uid) => langByUid.get(uid),
    "daily_reminder",
    { topic: todayContent.topic, question },
    { type: "daily_reminder", url: "/?daily=1" },
  );

  console.log("Daily reminder complete", {
    users: usersSnap.size,
    tokens: tokenEntries.length,
    sent,
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
    // Müəllimlərə streak təzyiqi göndərilmir (bax topicReminder şərhi).
    .filter((u) => u.role !== "teacher")
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
    // `u` is the whole user document, so the language is free here.
    const copy = pushText(pushLang(u), urgent ? "streak_urgent" : "streak_soft", { streak });
    const { sent: s, removed: r } = await sendPush(entries, {
      ...copy, type: "streak_rescue", url: "/",
    });
    sent += s;
    removed += r;
  }

  console.log("[StreakReminder]", { atRisk: atRisk.length, sent, urgent, invalidTokensRemoved: removed });
});

// Dev aləti. Əvvəllər BÜTÜN istifadəçilərə yayımlanırdı və auth-suz idi —
// indi yalnız verilən uid-in öz cihazlarına gedir, yayım imkanı yoxdur.
// Auth: YALNIZ admin. Auth-suz olduğu müddətdə URL-i bilən hər kəs istənilən
// istifadəçiyə push göndərə, `email` ilə hesabın mövcudluğunu yoxlaya
// (enumeration) və `debug=1` ilə cihaz metadatasını (userAgent, token quyruğu,
// tarixlər) oxuya bilirdi. Alət hələ lazımdır (native Android push real cihazda
// təsdiqlənməyib), ona görə silinmir — admin ilə kilidlənir.
exports.testPush = onRequest({ secrets: [] }, async (req, res) => {
  setCors(res, "GET, POST");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  try {
    const decoded = await verifyAuth(req);
    if (decoded.uid !== ADMIN_UID) return res.status(403).json({ error: "forbidden" });
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  let uid = String(req.query.uid || (req.body && req.body.uid) || "").trim();
  const email = String(req.query.email || (req.body && req.body.email) || "").trim().toLowerCase();
  if (!uid && !email) return res.status(400).json({ error: "uid or email required" });

  const db = admin.firestore();
  if (!uid) {
    const q = await db.collection("users").where("email", "==", email).limit(1).get();
    if (q.empty) return res.status(404).json({ error: "user not found by email" });
    uid = q.docs[0].id;
  }
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return res.status(404).json({ error: "user not found" });
  const u = userSnap.data();
  const tokenEntries = await getTokensForUser(db, uid, u.fcmToken, u.fcmTokenFailCount);

  // debug=1 → göndərmədən token inventarını göstər (platforma, yaş, quyruq).
  if (String(req.query.debug || "") === "1") {
    const docs = await db.collection("users").doc(uid).collection("fcmTokens").get();
    return res.status(200).json({
      uid,
      subcollection: docs.docs.map((d) => ({
        id: d.id.slice(0, 8),
        platform: d.data().platform || "(yox)",
        tokenTail: String(d.data().token || "").slice(-8),
        updatedAt: d.data().updatedAt ? d.data().updatedAt.toDate().toISOString() : null,
        userAgent: String(d.data().userAgent || "").slice(0, 60),
      })),
      legacyField: u.fcmToken ? "var" : "yox",
    });
  }

  if (tokenEntries.length === 0) return res.status(200).json({ error: "no tokens for this user" });

  const { sent, failed } = await sendPush(tokenEntries, {
    title: "🛠️ SpeakLab Test Mesajı",
    body: "Bu mesaj push bildirişlərinin düzgün işlədiyini yoxlamaq üçün göndərilmişdir.",
    type: "test",
    url: "/",
  });

  res.status(200).json({ sent, failed, tokens: tokenEntries.length, platforms: tokenEntries.map((e) => e.platform) });
});

// ─── Trial / Subscription ────────────────────────────────────
const TRIAL_MINUTES = 100;
const CALL_CAP_SECONDS = 60 * 60; // calls are capped at 60 minutes (client maxCallSeconds ilə sinxron)
const METERED_PLANS = new Set(["free", "trial"]);

// ─── Müəllim funnel-i ────────────────────────────────────────
// Müəllim qeydiyyatda "müəllim" seçmir: normal istifadəçi kimi danışır, öz AI
// analizini alır, yalnız 3 həqiqi sessiyadan sonra şagird izləmə açılır. Bu,
// heç bir yoxlama sistemi olmadan saxta müəllimlərin qarşısını alır.
const SESSION_MIN_SECONDS = 120;       // 2 dəq-dən qısa zəng sessiya sayılmır
const TEACHER_ELIGIBLE_SESSIONS = 3;   // bu qədər sessiyadan sonra kod yaratmaq açılır
const TEACHER_FREE_DAYS = 90;          // founding kohort üçün pulsuz dövr
const TEACHER_STUDENT_CAP = 30;
// Roster sətrində saxlanılan son səhv-mövzu başlıqlarının sayı. Sinif
// analitikası bu massivlərdən qurulur; sonsuz böyüməsin deyə pəncərə dardır.
const ROSTER_THEME_MEMORY = 6;
const MIN_LINK_AGE = 13;               // bundan kiçik heç bir halda bağlana bilməz
const ADULT_AGE = 18;                  // bundan kiçikdirsə valideyn razılığı tələb olunur

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
    // trialStartedAt burada — HƏR yeni userin keçdiyi yeganə nöqtə. Əvvəllər
    // yalnız Register client-ində yazılırdı; Login-dən Google ilə girən (və ya
    // App.js user sənədini əvvəl yaradan) yeni userdə boş qalırdı və
    // isTrialExpired heç vaxt işə düşmürdü → sonsuz pulsuz giriş. Client onu
    // yazmasa da (yaza da bilər — eyni an), gate indi mütləq işləyir.
    trialStartedAt: data.trialStartedAt || admin.firestore.FieldValue.serverTimestamp(),
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

      // Müəllim funnel-i üçün sessiya sayğacı. billedSec zəngin ÖZ vaxt
      // damğalarından gəlir (client saatından yox), ona görə üç dəfə dərhal
      // qapatmaqla müəllim rolunu açmaq mümkün deyil.
      //
      // Bu blok qəsdən aşağıdakı erkən return-dən ƏVVƏLdir: return metered
      // olmayan (kurs/premium) istifadəçilər üçün işə düşür, yəni məhz founding
      // müəllim olmağa ən yaxın adamlar heç vaxt sessiya qazana bilməzdi.
      if (billedSec >= SESSION_MIN_SECONDS) {
        const done = (Number(user.completedSessions) || 0) + 1;
        tx.set(userRef, {
          completedSessions: done,
          ...(done >= TEACHER_ELIGIBLE_SESSIONS ? { teacherEligible: true } : {}),
        }, { merge: true });

        // Roster rollup: şagird müəllimə bağlıdırsa, müəllimin dashboard-u üçün
        // proqres burada denormalizə olunur — dashboard hər açılışda bütün
        // şagird sənədlərini gəzmir, hazır roster sətrini oxuyur. streak/ad
        // client-yazılan sahələrdir, hesabat üçün kifayətdir (pul qərarı yox).
        if (user.teacherId) {
          tx.set(
            db.collection("teachers").doc(user.teacherId).collection("roster").doc(uid),
            {
              displayName: user.name || "",
              completedSessions: done,
              lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
              streak: Number(user.streak) || 0,
              status: "active",
            },
            { merge: true },
          );

          // Publik tutor profilində göstərilən "koçluq dəqiqəsi". Mənbə
          // billedSec-dir, yəni zəngin öz vaxt damğaları — client saymır.
          tx.set(db.collection("users").doc(user.teacherId), {
            tutorMinutesCoached: admin.firestore.FieldValue.increment(minutes),
          }, { merge: true });
        }
      }

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

// Monday-of-the-week "YYYY-MM-DD", computed from Baku's calendar date rather
// than the server's own clock — mirrors src/utils/ranking.js:getWeekKey, which
// runs on the user's device (assumed Baku, same as the rest of the backend's
// day-boundary logic). Pure calendar math on the (y,m,d) triple, no real TZ
// conversion, so it stays correct across month/year rollovers.
function bakuWeekKey(ms = Date.now()) {
  const todayStr = bakuDateStr(ms);
  const [y, m, d] = todayStr.split("-").map(Number);
  const weekday = bakuWeekday(todayStr); // 0=Sun..6=Sat
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(Date.UTC(y, m - 1, d - diffToMonday));
  const pad = (n) => String(n).padStart(2, "0");
  return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
}

// Shared by the trigger and the one-time backfill below: credits ONE
// participant's leaderboard stats for a finished call, guarded by the same
// statsApplied_{uid} flag the client writes in Chat.jsx's endCall. Re-reads
// both docs inside the transaction, so it is safe to call from multiple
// places (or multiple times) without double-crediting.
async function applyMissingCallStats(db, callRef, uid, durationMinutes) {
  await db.runTransaction(async (tx) => {
    const freshCallSnap = await tx.get(callRef);
    if (!freshCallSnap.exists) return;
    const freshCall = freshCallSnap.data() || {};
    if (freshCall[`statsApplied_${uid}`]) return; // already credited by the client or a prior run

    const userRef = db.collection("users").doc(uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return;
    const userData = userSnap.data() || {};

    const todayStr = bakuDateStr();
    const yesterdayStr = bakuDateStr(Date.now() - 86400000);
    const today = new Date(`${todayStr}T00:00:00Z`).toDateString();
    const yesterday = new Date(`${yesterdayStr}T00:00:00Z`).toDateString();
    let streak = userData.streak || 0;
    if (userData.lastCallDate === today) {
      // already counted today
    } else if (userData.lastCallDate === yesterday) {
      streak += 1;
    } else {
      streak = 1;
    }

    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const isSameMonth = userData.currentMonth === currentMonthStr;
    const newMonthMinutes = (isSameMonth ? (userData.currentMonthMinutes || 0) : 0) + durationMinutes;

    const weekKey = bakuWeekKey();
    const isSameWeek = userData.currentWeek === weekKey;
    const newWeekMinutes = (isSameWeek ? (userData.currentWeekMinutes || 0) : 0) + durationMinutes;

    tx.set(userRef, {
      callCount: (userData.callCount || 0) + 1,
      totalMinutes: (userData.totalMinutes || 0) + durationMinutes,
      streak,
      lastCallDate: today,
      currentMonth: currentMonthStr,
      currentMonthMinutes: newMonthMinutes,
      currentWeek: weekKey,
      currentWeekMinutes: newWeekMinutes,
    }, { merge: true });

    tx.set(callRef, {
      [`statsApplied_${uid}`]: true,
      [`statsAppliedAt_${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

// Safety net for leaderboard stats (totalMinutes/callCount/streak/weekly &
// monthly minutes). The client normally applies these itself when its own
// endCall() runs — but that requires the participant's OWN device to still be
// alive at hangup. If their app was backgrounded, killed, or crashed before
// that transaction ran, their side of the call was never credited: not wrong
// stats, ZERO stats, and they silently vanish from the leaderboard even
// though the call happened (observed 2026-08-08 — a full hour call where one
// side got nothing).
//
// This mirrors the exact statsApplied_{uid} flag the client writes in
// Chat.jsx's endCall, so whichever side runs first (a client, or this
// trigger) wins and the other is a no-op — safe to have both.
exports.reconcileCallStats = onDocumentWritten("calls/{callId}", async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const call = after.data() || {};
  if (call.status !== "ended") return;
  if (typeof call.authoritativeDurationSec !== "number") return;

  const durationSeconds = call.authoritativeDurationSec;
  if (durationSeconds <= 5) return; // matches the client's shouldApplyStats gate

  const participants = Array.from(new Set(
    [call.userA, call.userB, call.callerId, call.receiverId].filter(Boolean),
  )).slice(0, 2);
  if (participants.length < 2) return;

  const durationMinutes = Math.ceil(durationSeconds / 60);
  const db = admin.firestore();
  const callRef = after.ref;

  for (const uid of participants) {
    if (call[`statsApplied_${uid}`]) continue; // client already handled this side
    try {
      await applyMissingCallStats(db, callRef, uid, durationMinutes);
    } catch (e) {
      console.error("[reconcileCallStats] failed for", uid, e.message);
    }
  }
});

// One-time admin action: scans every call doc that already finished
// ('ended' + a pinned authoritativeDurationSec) for a participant whose
// statsApplied_{uid} flag was never set — i.e. calls that happened BEFORE
// reconcileCallStats existed, where one side's own client never ran endCall.
// Safe to run more than once: applyMissingCallStats re-checks the flag inside
// its own transaction, so an already-applied side is a no-op.
exports.backfillMissingCallStats = onRequest({ secrets: [] }, async (req, res) => {
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
  const snap = await db.collection("calls").where("status", "==", "ended").get();

  let scanned = 0;
  let fixed = 0;
  const fixedDetails = [];
  for (const docSnap of snap.docs) {
    scanned++;
    const call = docSnap.data() || {};
    if (typeof call.authoritativeDurationSec !== "number" || call.authoritativeDurationSec <= 5) continue;

    const participants = Array.from(new Set(
      [call.userA, call.userB, call.callerId, call.receiverId].filter(Boolean),
    )).slice(0, 2);
    if (participants.length < 2) continue;

    const durationMinutes = Math.ceil(call.authoritativeDurationSec / 60);
    for (const uid of participants) {
      if (call[`statsApplied_${uid}`]) continue;
      try {
        await applyMissingCallStats(db, docSnap.ref, uid, durationMinutes);
        fixed++;
        fixedDetails.push({ callId: docSnap.id, uid, durationMinutes });
      } catch (e) {
        console.error("[backfillMissingCallStats] failed for", docSnap.id, uid, e.message);
      }
    }
  }

  return res.status(200).json({ ok: true, scanned, fixed, fixedDetails });
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
      const alreadyWaiting = u.cohortStatus === "pending" || u.cohortStatus === "accepted";
      if (alreadyWaiting && u.cohortId === cohortRef.id) {
        return { alreadyApplied: true, cohortId: cohortRef.id, status: u.cohortStatus };
      }
      // BAŞQA kohortda gözləyir: keçidə icazə vermirik. Əks halda köhnə kohortun
      // pendingCount-u azalmadan qalır (kabus sayğac) — bir anda bir müraciət.
      if (alreadyWaiting && u.cohortId && u.cohortId !== cohortRef.id) {
        return { error: "already_applied_elsewhere" };
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
      const map = { code_inactive: 400, code_exhausted: 409, already_applied_elsewhere: 409 };
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

// ─── Müəllim ↔ Şagird bağlantısı ─────────────────────────────────
// Doğum tarixindən yaş. Yalnız ciddi YYYY-MM-DD qəbul edilir; "2020-02-31"
// kimi mövcud olmayan tarixi JS-in ISO parseri onsuz da Invalid Date edir.
function ageFromBirthDate(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const born = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  if (born.getTime() > now.getTime()) return null; // gələcək tarix
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) age--;
  if (age > 120) return null;
  return age;
}

// invoker: "public" — generateQuiz-dəki ilə eyni səbəb: Cloud Run brauzerin
// Authorization başlığı olmayan OPTIONS preflight-ını handler-ə çatmamış rədd
// edir. İstifadəçi aşağıda verifyAuth ilə yenə də doğrulanır.
exports.createInviteCode = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const rawCode = req.body && req.body.code;
  if (!rawCode || typeof rawCode !== "string") return res.status(400).json({ error: "invalid-code" });
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return res.status(400).json({ error: "invalid-code" });

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(uid, "createInviteCode", 10, 60 * 60 * 1000);

    await db.runTransaction(async (tx) => {
      const codeRef = db.collection("inviteCodes").doc(code);
      const userRef = db.collection("users").doc(uid);
      const teacherRef = db.collection("teachers").doc(uid);

      // Bütün oxumalar yazılardan əvvəl (evdəki qayda — bax claimTicket).
      const userSnap = await tx.get(userRef);
      const codeSnap = await tx.get(codeRef);
      const teacherSnap = await tx.get(teacherRef);

      if (!userSnap.exists) throw fail(404, "user-not-found");
      const user = userSnap.data() || {};
      // teacherEligible yalnız server tərəfindən, 3 həqiqi sessiyadan sonra
      // yazılır və rules ilə clientə bağlıdır.
      if (user.teacherEligible !== true) throw fail(403, "not-eligible");
      if (codeSnap.exists) throw fail(409, "code-taken");

      if (!teacherSnap.exists) {
        tx.set(teacherRef, {
          displayName: user.name || "",
          bio: user.bio || "",
          cohort: "founding",
          freeUntil: admin.firestore.Timestamp.fromMillis(
            Date.now() + TEACHER_FREE_DAYS * 24 * 60 * 60 * 1000),
          studentCap: TEACHER_STUDENT_CAP,
          studentCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      // Kodun özü teachers/{uid}-də də saxlanılır: inviteCodes kolleksiyası
      // clientə tamamilə bağlıdır (enumeration-un qarşısını almaq üçün), ona
      // görə müəllim öz kodunu başqa cür geri oxuya bilməzdi.
      tx.set(teacherRef, { inviteCode: code }, { merge: true });
      tx.set(userRef, { role: "teacher" }, { merge: true });
      tx.set(codeRef, {
        teacherId: uid,
        active: true,
        uses: 0,
        maxUses: TEACHER_STUDENT_CAP,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: null,
      });
    });

    return res.status(200).json({ ok: true, code });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[createInviteCode]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// Şagird müəllimin kodunu istifadə edir. Rate limit burada TƏHLÜKƏSİZLİK
// nəzarətidir, nəzakət deyil: 4 simvolluq kod sahəsi brute-force edilə bilər.
exports.claimTeacherCode = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const { code: rawCode, birthDate, consent, guardianConsent } = req.body || {};

  if (!rawCode || typeof rawCode !== "string") return res.status(400).json({ error: "invalid-code" });
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return res.status(400).json({ error: "invalid-code" });

  // Ucuz, oxumasız yoxlamalar tranzaksiyadan kənarda.
  // Razılıq HƏR HALDA tələb olunur — müəllim şagirdin analizlərini görəcək.
  if (consent !== true) return res.status(400).json({ error: "consent-required" });

  // Doğum tarixi artıq MƏCBURİ DEYİL: qoşulma ekranından çıxarıldı (əlavə
  // sürtünmə yaradırdı). Google hesabı doğum tarixini vermir — bunun üçün
  // People API + ayrıca `birthday` icazəsi lazımdır və istifadəçilərin
  // əksəriyyətində bu sahə gizlidir — ona görə avtomatik doldurmaq mümkün deyil.
  // Göndərilibsə yenə də yoxlanılır (köhnə client-lər və gələcək istifadə üçün).
  let age = null;
  let isAdult = null;
  if (birthDate) {
    age = ageFromBirthDate(birthDate);
    if (age === null || age < MIN_LINK_AGE) return res.status(403).json({ error: "age-restricted" });
    isAdult = age >= ADULT_AGE;
    if (!isAdult && guardianConsent !== true) {
      return res.status(400).json({ error: "guardian-consent-required" });
    }
  }

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(uid, "claimTeacherCode", 5, 60 * 60 * 1000);

    const teacherId = await db.runTransaction(async (tx) => {
      const codeRef = db.collection("inviteCodes").doc(code);
      const userRef = db.collection("users").doc(uid);

      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) throw fail(404, "code-not-found");
      const invite = codeSnap.data() || {};

      if (invite.active !== true) throw fail(403, "code-inactive");
      if (invite.expiresAt && invite.expiresAt.toMillis && invite.expiresAt.toMillis() <= Date.now()) {
        throw fail(403, "code-expired");
      }
      if ((Number(invite.uses) || 0) >= (Number(invite.maxUses) || 0)) throw fail(409, "code-exhausted");
      if (invite.teacherId === uid) throw fail(400, "self-link");

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw fail(404, "user-not-found");
      const user = userSnap.data() || {};
      if (user.teacherId) throw fail(409, "already-linked");

      const teacherRef = db.collection("teachers").doc(invite.teacherId);
      const teacherSnap = await tx.get(teacherRef);
      if (!teacherSnap.exists) throw fail(404, "code-not-found");
      const teacher = teacherSnap.data() || {};
      if ((Number(teacher.studentCount) || 0) >= (Number(teacher.studentCap) || TEACHER_STUDENT_CAP)) {
        throw fail(409, "teacher-full");
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(userRef, {
        teacherId: invite.teacherId,
        teacherLinkedAt: now,
        teacherConsentAt: now,
        // Yaş sahələri yalnız doğum tarixi göndərilibsə yazılır — sahə artıq
        // məcburi deyil, `undefined` yazmaq isə Firestore-da xətadır.
        ...(birthDate ? { ageConfirmedAt: now, isAdult } : {}),
      }, { merge: true });

      // Xam doğum tarixi users/{uid}-də SAXLANILMIR: o sənədi hər daxil olmuş
      // istifadəçi oxuya bilir (firestore.rules). Hüquqi qeyd burada, yalnız
      // sahibinin oxuya bildiyi private alt-kolleksiyada qalır.
      if (birthDate) {
        tx.set(userRef.collection("private").doc("ageAttestation"), {
          birthDate,
          isAdult,
          guardianConsent: guardianConsent === true,
          attestedAt: now,
        });
      }

      tx.set(teacherRef.collection("roster").doc(uid), {
        displayName: user.name || "",
        level: user.level || null,
        joinedAt: now,
        status: "active",
        // Sonrakı fazada rollup writer dolduracaq.
        lastActiveAt: null,
        streak: 0,
        sessionsLast7: 0,
      });

      tx.update(codeRef, { uses: admin.firestore.FieldValue.increment(1) });
      tx.update(teacherRef, { studentCount: admin.firestore.FieldValue.increment(1) });
      // studentCount teachers/{tid}-dədir, o sənəd isə yalnız sahibinə oxunandır.
      // Publik tutor profilində şagird sayını göstərmək üçün users/{tid}-ə güzgü
      // saxlanılır — profil ekranı o sənədi onsuz da yükləyir.
      tx.set(db.collection("users").doc(invite.teacherId), {
        tutorStudentCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true });

      return invite.teacherId;
    });

    return res.status(200).json({ ok: true, teacherId });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[claimTeacherCode]", e.message);
    return res.status(status).json({ error: e.message });
  }
});


// ─── Müəllimdən şagirdə "bugünkü məşqi bitir" xatırlatması ──────────
// A teacher can see who has not practised today, and until now could do
// nothing about it inside the app — the roster showed a stale date and the
// only way to chase a student was WhatsApp. This sends one push.
//
// Three guards, and each of them exists to stop the feature becoming spam:
//   1. Only the student's OWN teacher may send. Checked against
//      users/<studentUid>.teacherId, not the roster row, which can outlive an
//      unlink.
//   2. Nobody who has already practised today gets nudged. Nagging someone who
//      did the work is the fastest way to make a class mute notifications.
//   3. One nudge per student per day, no matter how many times the button is
//      pressed or how many teachers press it.
//
// The "did they practise" and "were they nudged" facts both live on the roster
// row the teacher panel ALREADY loads, so neither check costs the panel an
// extra read, and the button can render its own state after a reload.
exports.nudgeStudent = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
  const teacherUid = decoded.uid;

  const studentUid = String((req.body || {}).studentUid || "").trim();
  if (!studentUid || studentUid.length > 128) {
    return res.status(400).json({ error: "invalid-student" });
  }
  if (studentUid === teacherUid) return res.status(400).json({ error: "invalid-student" });

  // A ceiling on the teacher as well as on each student: 40 a day is far more
  // than any real class and still bounds what one account can send.
  try {
    await enforceRateLimit(teacherUid, "nudgeStudent", 40, 24 * 60 * 60 * 1000);
  } catch (e) {
    return res.status(e.httpStatus || 429).json({ error: "rate-limited" });
  }

  const db = admin.firestore();
  const today = bakuDateStr();

  try {
    const studentSnap = await db.collection("users").doc(studentUid).get();
    if (!studentSnap.exists) return res.status(404).json({ error: "not-found" });
    const student = studentSnap.data() || {};
    if (student.teacherId !== teacherUid) {
      return res.status(403).json({ error: "not-your-student" });
    }

    const rosterRef = db.collection("teachers").doc(teacherUid)
      .collection("roster").doc(studentUid);
    const rosterSnap = await rosterRef.get();
    const roster = rosterSnap.exists ? (rosterSnap.data() || {}) : {};

    // Already practised today? Then there is nothing to ask for. lastAnalysisAt
    // is written by the analysis pipeline at the moment a session is graded.
    const lastMs = roster.lastAnalysisAt && roster.lastAnalysisAt.toMillis
      ? roster.lastAnalysisAt.toMillis()
      : 0;
    if (lastMs && bakuDateStr(lastMs) === today) {
      return res.status(200).json({ ok: false, reason: "already-practised" });
    }

    if (roster.lastNudgedOn === today) {
      return res.status(200).json({ ok: false, reason: "already-nudged" });
    }

    const teacherSnap = await db.collection("users").doc(teacherUid).get();
    const teacherName = String((teacherSnap.data() || {}).name || "").trim();

    const entries = await getTokensForUser(db, studentUid, student.fcmToken, student.fcmTokenFailCount);
    if (!entries.length) {
      // No device to reach. Still stamp it: the teacher should be told the
      // difference between "sent" and "this student has notifications off"
      // rather than pressing a button that quietly does nothing.
      await rosterRef.set({ lastNudgedOn: today }, { merge: true });
      return res.status(200).json({ ok: false, reason: "no-devices" });
    }

    // `student` is the already-loaded student document, so no extra read.
    const copy = pushText(pushLang(student), "teacher_nudge", { teacherName });
    const { sent } = await sendPush(entries, {
      ...copy,
      type: "teacher_nudge",
      url: "/practice",
    });

    await rosterRef.set({ lastNudgedOn: today }, { merge: true });
    return res.status(200).json({ ok: sent > 0, sent, reason: sent > 0 ? "sent" : "no-devices" });
  } catch (e) {
    console.error("[nudgeStudent]", e);
    return res.status(500).json({ error: "failed" });
  }
});

// ─── Birbaşa şagird dəvəti ───────────────────────────────────────
// Kod paylaşmaq həmişə işləmir: link mesajda itir, şagird kodu səhv yazır.
// Bu axında müəllim şagirdin e-poçtunu yazır, dəvət ŞAGİRDİN HESABINA düşür
// və push bildirişi gedir. Şagird qəbul edəndə bağlantı avtomatik qurulur —
// kod yazmağa ehtiyac qalmır.
//
// Razılıq yenə AÇIQdır: qəbul düyməsinin yanında müəllimin analizləri görəcəyi
// yazılır, qəbul özü razılıq sayılır (kod axınındakı checkbox ilə eyni).
exports.inviteStudentByEmail = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const teacherId = decoded.uid;
  // İki giriş yolu: e-poçt (müəllim əl ilə yazır) və uid (müəllim panelindəki
  // istifadəçi siyahısından bir toxunuşla). uid yolu daha etibarlıdır — səhv
  // yazılmış e-poçt "student-not-found" verirdi və müəllim səbəbini bilmirdi.
  const directUid = (req.body && req.body.studentUid) || "";
  const rawEmail = (req.body && req.body.email) || "";
  const email = String(rawEmail).trim().toLowerCase();
  if (!directUid && (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return res.status(400).json({ error: "invalid-email" });
  }

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(teacherId, "inviteStudent", 30, 60 * 60 * 1000);

    const teacherSnap = await db.collection("users").doc(teacherId).get();
    const teacher = teacherSnap.exists ? teacherSnap.data() : {};
    if (teacher.role !== "teacher" && teacher.teacherEligible !== true) {
      throw fail(403, "not-a-teacher");
    }

    let studentUid;
    let student;
    if (directUid) {
      const snap = await db.collection("users").doc(String(directUid)).get();
      if (!snap.exists) throw fail(404, "student-not-found");
      studentUid = snap.id;
      student = snap.data() || {};
    } else {
      // Şagirdi e-poçta görə tap. Firestore-da e-poçt users sənədində saxlanılır.
      const found = await db.collection("users").where("email", "==", email).limit(1).get();
      if (found.empty) throw fail(404, "student-not-found");
      studentUid = found.docs[0].id;
      student = found.docs[0].data() || {};
    }

    if (studentUid === teacherId) throw fail(400, "self-invite");
    if (student.teacherId === teacherId) throw fail(409, "already-your-student");
    if (student.teacherId) throw fail(409, "already-linked");

    // Bir cütlük üçün bir dəvət: sənəd id-si sabitdir, təkrar dəvət köhnəni
    // yeniləyir — şagirdin qutusu eyni dəvətlə dolmur.
    const inviteId = `${teacherId}_${studentUid}`;
    const inviteRef = db.collection("teacherInvites").doc(inviteId);

    await inviteRef.set({
      teacherId,
      teacherName: teacher.name || "",
      studentUid,
      studentEmail: student.email || email || "",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // "Sorğu çatmır" probleminin əsas həlli: şagird bildirişlə xəbər tutur.
    await sendPushToUser(db, studentUid, {
      key: "teacher_invite",
      vars: { teacherName: teacher.name },
      type: "teacher_invite",
      url: "/",
    }).catch(() => null);

    return res.status(200).json({
      ok: true,
      inviteId,
      studentName: student.name || "",
      studentUid,
    });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[inviteStudentByEmail]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// Şagird dəvəti qəbul edir və ya rədd edir. Qəbul halında bağlantı
// claimTeacherCode ilə EYNİ yazıları edir — iki fərqli bağlanma yolu
// olmasın deyə sahələr birə-bir eynidir.
exports.respondTeacherInvite = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const { inviteId, accept } = req.body || {};
  if (!inviteId || typeof inviteId !== "string") {
    return res.status(400).json({ error: "invalid-invite" });
  }

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(uid, "respondTeacherInvite", 20, 60 * 60 * 1000);

    const result = await db.runTransaction(async (tx) => {
      const inviteRef = db.collection("teacherInvites").doc(inviteId);
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw fail(404, "invite-not-found");
      const invite = inviteSnap.data() || {};

      // Yalnız dəvət olunan şagird cavab verə bilər.
      if (invite.studentUid !== uid) throw fail(403, "not-your-invite");
      if (invite.status !== "pending") throw fail(409, "already-answered");

      if (accept !== true) {
        tx.update(inviteRef, {
          status: "declined",
          respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { linked: false };
      }

      const userRef = db.collection("users").doc(uid);
      const teacherRef = db.collection("teachers").doc(invite.teacherId);
      const userSnap = await tx.get(userRef);
      const teacherSnap = await tx.get(teacherRef);
      if (!userSnap.exists) throw fail(404, "user-not-found");
      const user = userSnap.data() || {};
      if (user.teacherId) throw fail(409, "already-linked");

      const teacher = teacherSnap.exists ? teacherSnap.data() : {};
      const cap = Number(teacher.studentCap) || TEACHER_STUDENT_CAP;
      if ((Number(teacher.studentCount) || 0) >= cap) throw fail(409, "teacher-full");

      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(userRef, {
        teacherId: invite.teacherId,
        teacherLinkedAt: now,
        teacherConsentAt: now,
      }, { merge: true });

      tx.set(teacherRef.collection("roster").doc(uid), {
        displayName: user.name || "",
        level: user.level || null,
        joinedAt: now,
        status: "active",
        lastActiveAt: null,
        streak: 0,
        sessionsLast7: 0,
      });

      // Müəllim sənədi hələ yoxdursa yaradılır (kod yaratmamış müəllim də
      // birbaşa dəvət göndərə bilir). Sahələr createInviteCode-dakı ilə BİRƏ-BİR
      // eyni olmalıdır: əks halda ilk şagirdini e-poçt dəvəti ilə alan müəllimin
      // sənədi natamam qalır (displayName/bio/freeUntil olmadan) və profil
      // redaktoru boş sənəd üzərində açılır.
      tx.set(teacherRef, {
        studentCount: admin.firestore.FieldValue.increment(1),
        ...(teacherSnap.exists ? {} : {
          // Müəllimin adı users/{tid}-dən deyil, dəvətin özündən götürülür —
          // burada oxunan userRef ŞAGİRDİNdir, müəllimin deyil.
          displayName: invite.teacherName || "",
          bio: "",
          cohort: "founding",
          freeUntil: admin.firestore.Timestamp.fromMillis(
            Date.now() + TEACHER_FREE_DAYS * 24 * 60 * 60 * 1000),
          studentCap: TEACHER_STUDENT_CAP,
          createdAt: now,
        }),
      }, { merge: true });

      // Publik profil üçün güzgü sayğac — bax claimTeacherCode.
      tx.set(db.collection("users").doc(invite.teacherId), {
        tutorStudentCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true });

      tx.update(inviteRef, { status: "accepted", respondedAt: now });
      return { linked: true, teacherId: invite.teacherId };
    });

    if (result.linked) {
      const uSnap = await db.collection("users").doc(uid).get();
      const name = uSnap.exists ? (uSnap.data().name || "") : "";
      await sendPushToUser(db, result.teacherId, {
        key: "invite_accepted",
        vars: { studentName: name },
        type: "invite_accepted",
        url: `/teacher/student/${uid}`,
      }).catch(() => null);
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[respondTeacherInvite]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// ─── Çat mesajı bildirişi ─────────────────────────────────────────
// Bu YOX idi: kimsə mesaj yazanda qarşı tərəfə heç bir siqnal getmirdi. Yeganə
// öyrənmə yolu həmin adamın profilinə girib çata açmaq idi — yəni mesajlaşma
// praktiki olaraq işləmirdi.
//
// Oxunmamış sayğac SERVERDƏ artırılır: client-in öz sayğacını qaldırması
// mənasız, qarşı tərəfinkini qaldırması isə sui-istifadədir. Client yalnız
// AÇANDA öz sayını sıfırlayır (rules bunu birbaşa məhdudlaşdırır).
exports.notifyChatMessage = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const msg = event.data ? event.data.data() : null;
  if (!msg || !msg.senderId) return;

  const db = admin.firestore();
  const chatId = event.params.chatId;
  const chatRef = db.collection("chats").doc(chatId);

  try {
    const chatSnap = await chatRef.get();
    const participants = chatSnap.exists ? (chatSnap.data().participants || []) : [];
    // participants yoxdursa sənəd id-sindən çıxarırıq (id = sıralanmış uid cütü).
    const pair = participants.length === 2 ? participants : chatId.split("_");
    const recipient = pair.find((p) => p && p !== msg.senderId);
    if (!recipient) return;

    // Oxunmamış sayğac hər halda artır — bloklanmış olsa belə siyahı düzgün
    // qalsın deyə; yalnız PUSH bloklanır.
    await chatRef.set({
      unread: { [recipient]: admin.firestore.FieldValue.increment(1) },
    }, { merge: true });

    const blocked = await db.collection("users").doc(recipient)
      .collection("blocked").doc(msg.senderId).get();
    if (blocked.exists) return;

    const body = String(msg.text || "").slice(0, 120);
    await sendPushToUser(db, recipient, {
      title: msg.senderName || "Yeni mesaj",
      body: body || "Yeni mesaj",
      type: "chat_message",
      // Birbaşa həmin söhbətə aparır — istifadəçi mesajı axtarmamalıdır.
      url: `/chat/${msg.senderId}`,
    });
  } catch (e) {
    console.warn("[ChatPush] failed:", chatId, e.message);
  }
});

// ─── Tutor profili və təsdiqi ─────────────────────────────────────
// Nişan (badge) YALNIZ təsdiqlənmiş müəllimdə görünür. Səbəb: `role: "teacher"`
// qeydiyyatda istifadəçinin öz seçimidir (firestore.rules bir dəfəlik yazmağa
// icazə verir) — nişanı `role`-a bağlasaq onu hər kəs beş saniyəyə alar və nişan
// dəyərsizləşər. Təsdiq admin qərarıdır: `users/{uid}.teacherVerified`.
//
// Publik sahələr users/{uid}-ə GÜZGÜLƏNİR, teachers/{tid}-dən oxunmur: teachers
// sənədi yalnız sahibinə oxunandır və içində inviteCode var — onu publik etmək
// dəvət kodunu hər kəsə açardı (maxUses tükədilə bilər). Üstəlik nişanın
// görünəcəyi hər ekran (sıralama, lobbi, zəng, profil) tam users sənədini onsuz
// da yükləyir → əlavə Firestore oxusu sıfır.

// Sərbəst mətn əvəzinə qapalı siyahı: ixtisas publik profildə görünür, client isə
// istənilən sətri göndərə bilər. Siyahı UI-dakı chip seçimi ilə eynidir.
const TUTOR_SPECIALTIES = [
  "IELTS", "TOEFL", "Speaking", "Business English",
  "Grammar", "Kids", "Beginner", "Exam Prep",
];

exports.updateTeacherProfile = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const body = req.body || {};

  const displayName = String(body.displayName || "").trim().slice(0, 60);
  const bio = String(body.bio || "").trim().slice(0, 400);
  const specialties = Array.isArray(body.specialties)
    ? [...new Set(body.specialties.filter((s) => TUTOR_SPECIALTIES.includes(s)))].slice(0, 5)
    : [];
  const yearsRaw = Number(body.yearsExperience);
  const yearsExperience = Number.isFinite(yearsRaw)
    ? Math.min(60, Math.max(0, Math.round(yearsRaw)))
    : 0;

  if (!displayName) return res.status(400).json({ error: "name-required" });

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(uid, "teacherProfile", 20, 60 * 60 * 1000);

    const nextStatus = await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const teacherRef = db.collection("teachers").doc(uid);
      const userSnap = await tx.get(userRef);
      const teacherSnap = await tx.get(teacherRef);

      if (!userSnap.exists) throw fail(404, "user-not-found");
      const user = userSnap.data() || {};
      if (user.role !== "teacher" && user.teacherEligible !== true) {
        throw fail(403, "not-a-teacher");
      }

      const teacher = teacherSnap.exists ? teacherSnap.data() : {};
      // Təsdiqlənmiş müəllim profilini redaktə edəndə status İTMİR — nişan
      // sönüb-yanmır. Dəyişiklik profileUpdatedAt-a düşür, admin paneli isə
      // profileUpdatedAt > verifiedAt olanları yenidən baxış üçün işarələyir.
      const status = teacher.verificationStatus === "verified" ? "verified" : "pending";
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(teacherRef, {
        displayName, bio, specialties, yearsExperience,
        verificationStatus: status,
        profileUpdatedAt: now,
        // Kod yaratmamış müəllim də profil doldura bilir — sənəd sahələri
        // createInviteCode-dakı ilə eyni olmalıdır.
        ...(teacherSnap.exists ? {} : {
          cohort: "founding",
          freeUntil: admin.firestore.Timestamp.fromMillis(
            Date.now() + TEACHER_FREE_DAYS * 24 * 60 * 60 * 1000),
          studentCap: TEACHER_STUDENT_CAP,
          studentCount: 0,
          createdAt: now,
        }),
      }, { merge: true });

      // Publik alt-dəst. teacherVerified BURADA YAZILMIR — o, yalnız adminin
      // setTutorVerification çağırışından gəlir.
      tx.set(userRef, {
        tutorProfile: { displayName, bio, specialties, yearsExperience },
      }, { merge: true });

      return status;
    });

    return res.status(200).json({ ok: true, verificationStatus: nextStatus });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[updateTeacherProfile]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// Təsdiq/ləğv — YALNIZ admin. Ayrıca funksiya lazımdır: teachers sənədi rules-da
// hər kəsə (admin daxil) yazılmazdır, üstəlik iki sənəd —
// teachers/{tid}.verificationStatus və users/{tid}.teacherVerified — bir-birindən
// ayrı düşməməlidir, ona görə tək batch ilə atomik yazılır.
exports.setTutorVerification = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (decoded.uid !== ADMIN_UID) return res.status(403).json({ error: "forbidden" });

  const { teacherId, verified } = req.body || {};
  if (!teacherId || typeof teacherId !== "string") {
    return res.status(400).json({ error: "invalid-teacher" });
  }

  const db = admin.firestore();

  try {
    const isVerified = verified === true;
    const now = admin.firestore.FieldValue.serverTimestamp();

    const batch = db.batch();
    batch.set(db.collection("teachers").doc(teacherId), {
      verificationStatus: isVerified ? "verified" : "rejected",
      verifiedAt: isVerified ? now : null,
    }, { merge: true });
    batch.set(db.collection("users").doc(teacherId), {
      teacherVerified: isVerified,
      // Təsdiq edilən şəxs mütləq müəllim rejimində olmalıdır (admin panelindən
      // birbaşa təsdiq edilə bilər, o halda rol hələ qoyulmamış ola bilər).
      ...(isVerified ? { role: "teacher", teacherEligible: true } : {}),
    }, { merge: true });
    await batch.commit();

    if (isVerified) {
      await sendPushToUser(db, teacherId, {
        key: "tutor_verified",
        type: "tutor_verified",
        url: "/teacher",
      }).catch(() => null);
    }

    return res.status(200).json({ ok: true, verified: isVerified });
  } catch (e) {
    console.error("[setTutorVerification]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Praktika slotları: koordinasiya ──────────────────────────────
// 20 nəfərlik bazada "aç → indi kimsə tap" işləmir: istənilən anda onlayn adam
// sayı ~0–2-dir. Problem az istifadəçi DEYİL — sistem niyyəti yaddaşa yazmırdı:
// axtarış bileti 2 dəqiqədən sonra silinirdi, deməli Səbinənin 14:00-dakı
// cəhdindən Rümeysanın xəbər tutması fiziki olaraq mümkün deyildi.
//
// Model: istifadəçi 2 saatlıq bloka "müsaitəm" yazır. İki nəfər eyni bloka
// düşəndə sistem onları AVTOMATİK cütləşdirir — sorğu/qəbul mərhələsi yoxdur,
// ona görə rədd edilmək də mümkün deyil (özgüvən qorunur). Lövhədə ad görünmür,
// yalnız say: düymə ŞƏXSƏ yox, BLOKA basılır, deməli cherry-picking yoxdur.
//
// SƏVİYYƏ QAPISI QƏSDƏN YOXDUR: bir blokda iki nəfər varsa, eşləşirlər. Nöqtə.
// Az istifadəçi ilə istənilən filtr eşləşmə şansını sıfıra endirir; A2-nin B2
// ilə danışması heç danışmamaqdan qat-qat yaxşıdır. Səviyyə yalnız eşləşmədən
// SONRA, bildiriş mətnini seçmək üçün oxunur.
const SLOT_BLOCK_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const SLOT_BLOCK_MS = 2 * 60 * 60 * 1000;
// Client-dəki eyni adlı sabitlə (src/utils/practiceSlots.js) EYNİ qalmalıdır:
// lövhə beş gün göstərir, joinPracticeSlot isə üfüqdən kənar slotu rədd edir —
// fərq olsa lövhədəki son günlər "slot-too-far" verib səssizcə işləməzdi.
const SLOT_HORIZON_DAYS = 5;
const SLOT_REMINDER_MS = 10 * 60 * 1000;
const SLOT_NOSHOW_GRACE_MS = 10 * 60 * 1000;
const SLOT_MAX_MEMBERS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// slotId = "YYYY-MM-DD-HH" (Bakı saatı, UTC+4, DST yoxdur) — hər cihaz eyni
// sətri hesablasın deyə saat İKİ rəqəmlə doldurulur.
function parseSlotId(slotId) {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(String(slotId || ""));
  if (!m) return null;
  const hour = Number(m[2]);
  if (!SLOT_BLOCK_HOURS.includes(hour)) return null;
  const startMs = Date.parse(`${m[1]}T${m[2]}:00:00+04:00`);
  if (!Number.isFinite(startMs)) return null;
  return { slotId, date: m[1], hour, startMs, endMs: startMs + SLOT_BLOCK_MS };
}

const slotIdOf = (date, hour) => `${date}-${String(hour).padStart(2, "0")}`;
const callIdForPair = (a, b) => `call_${[a, b].sort().join("_")}`;

// Bloka qoşulma nüvəsi. HTTP funksiyası da, təkrarlanan slotları materiallaşdıran
// planlaşdırıcı da eyni məntiqi işlədir — iki fərqli qoşulma yolu olmasın deyə.
// Tranzaksiya daxilində çağırılır; push commit-dən SONRA göndərilir.
async function joinSlotTx(db, tx, slot, uid, user) {
  const slotRef = db.collection("practiceSlots").doc(slot.slotId);
  const membersRef = slotRef.collection("members");

  const membersSnap = await tx.get(membersRef.limit(SLOT_MAX_MEMBERS));
  const members = membersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

  if (members.some((m) => m.id === uid)) return { already: true };

  const partner = members.find((m) => m.id !== uid && m.status === "waiting") || null;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const usersCol = db.collection("users");

  tx.set(membersRef.doc(uid), {
    uid,
    name: user.name || "",
    level: user.level || null,
    joinedAt: now,
    status: partner ? "matched" : "waiting",
    ...(partner ? { pairedWith: partner.id, callId: callIdForPair(uid, partner.id) } : {}),
  });

  tx.set(usersCol.doc(uid), {
    practiceSlotIds: admin.firestore.FieldValue.arrayUnion(slot.slotId),
    ...(partner ? {
      upcomingCall: {
        slotId: slot.slotId, startMs: slot.startMs,
        peerUid: partner.id, peerName: partner.name || "",
        callId: callIdForPair(uid, partner.id),
      },
    } : {}),
  }, { merge: true });

  if (partner) {
    const callId = callIdForPair(uid, partner.id);
    const sorted = [uid, partner.id].sort();

    tx.set(membersRef.doc(partner.id), {
      status: "matched", pairedWith: uid, callId,
    }, { merge: true });

    tx.set(usersCol.doc(partner.id), {
      upcomingCall: {
        slotId: slot.slotId, startMs: slot.startMs,
        peerUid: uid, peerName: user.name || "", callId,
      },
    }, { merge: true });

    // status "accepted" QƏSDƏNDİR: "calling" olsaydı GlobalCallListener qarşı
    // tərəfin telefonunu ELƏ İNDİ çaldırardı. Randevu gələcəkdədir — hər iki
    // tərəf öz vaxtında bu kanala qoşulur (Chat.jsx matchedCall yolu).
    tx.set(db.collection("calls").doc(callId), {
      userA: sorted[0], userB: sorted[1],
      callerId: uid, receiverId: partner.id,
      status: "accepted", source: "slot_match",
      slotId: slot.slotId, createdAt: now,
    }, { merge: true });
  }

  const others = members.filter((m) => m.id !== uid);
  const waitingOthers = others.filter((m) => m.status === "waiting").length;
  const matchedOthers = others.filter((m) => m.status === "matched").length;

  tx.set(slotRef, {
    date: slot.date,
    startHour: slot.hour,
    startMs: slot.startMs,
    // Lövhə YALNIZ bu sənədi oxuyur — burada ad yoxdur, ona görə anonimlik
    // əlavə sorğu olmadan qorunur.
    waitingCount: partner ? waitingOthers - 1 : waitingOthers + 1,
    matchedCount: partner ? matchedOthers + 2 : matchedOthers,
    updatedAt: now,
  }, { merge: true });

  return {
    matched: !!partner,
    partnerId: partner ? partner.id : null,
    partnerName: partner ? (partner.name || "") : "",
    partnerLevel: partner ? (partner.level || null) : null,
    callId: partner ? callIdForPair(uid, partner.id) : null,
  };
}

// Fərqli bloklarda tək qalanları bir-birindən xəbərdar edir.
//
// Ssenari: biri 18:00-a, digəri 21:00-a yazılır. İkisi də "müsaitəm" deyib, ikisi
// də zəng istəyir, amma sistem heç nə edə bilmir — bloklar fərqlidir və eyni
// blokda iki nəfər olmadan cüt qurulmur. Nəticədə hər ikisi tək qalır.
//
// Həll: yeni gələn tək qalanda, HƏMİN GÜN başqa blokda tək gözləyənlərə bildiriş
// gedir. Onlar bir blok da əlavə etsə, cüt dərhal qurulur. Marker sayəsində
// hər istifadəçi gündə ƏN ÇOX BİR belə bildiriş alır — əks halda hər qoşulma
// bütün gözləyənlərə push atardı.
async function nudgeLoneWaiters(db, slot, joinerUid) {
  try {
    const snap = await db.collection("practiceSlots").where("date", "==", slot.date).get();
    for (const d of snap.docs) {
      if (d.id === slot.slotId) continue;
      if ((Number((d.data() || {}).waitingCount) || 0) <= 0) continue;
      const other = parseSlotId(d.id);
      if (!other || other.endMs <= Date.now()) continue;

      const waiting = await d.ref.collection("members")
        .where("status", "==", "waiting").limit(5).get();
      for (const m of waiting.docs) {
        if (m.id === joinerUid) continue;
        if (!(await claimSlotRun(db, `${slot.date}_nudge_${m.id}`))) continue;
        await sendPushToUser(db, m.id, {
          key: "slot_nearby",
          vars: { at: slot.startMs },
          type: "slot_nearby",
          url: "/",
        }).catch(() => null);
      }
    }
  } catch (e) {
    console.warn("[SlotNudge] failed:", e.message);
  }
}

// CEFR sıralaması — yalnız ego-boost mətnini seçmək üçün. Eşləşməyə TƏSİR ETMİR.
const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const cefrRank = (level) => {
  const code = String(level || "").trim().slice(0, 2).toUpperCase();
  const i = CEFR_ORDER.indexOf(code);
  return i === -1 ? null : i;
};

// Copy is resolved inside sendPushToUser, in the recipient's own language and
// timezone — this only decides WHICH of the two framings to use.
function slotMatchPush(startMs, peerName, myRank, peerRank) {
  // Səviyyəsi daha yüksək tərəf zəngi ləğv etməsin deyə mentorluq çərçivəsi.
  const mentor = myRank !== null && peerRank !== null && myRank > peerRank;
  return {
    key: mentor ? "slot_matched_mentor" : "slot_matched",
    vars: { at: startMs, peerName },
    type: "slot_matched",
    url: "/",
  };
}

// The old slotHourLabel() lived here: it formatted "Bu gün 14:00" in Baku time
// and in Azerbaijani, then handed the finished string to every push. It could
// not do the right thing, because the SENDER does not know who is reading —
// the label has to be built per recipient. That job now belongs to
// pushText.slotTimeLabel(), which sendPushToUser calls with the reader's own
// language and timezone; callers pass `vars.at` (an absolute ms timestamp).

// Eşləşəndən SONRA həmin günün qalan bloklarını buraxır.
//
// Problem: `upcomingCall` istifadəçi sənədində TƏK sahədir, amma bir nəfər
// istədiyi qədər bloka yazıla bilir. Beş bloka yazılan şagird beş blokda da
// "waiting" qalırdı, yəni HƏR birində yenidən tutula bilirdi: ikinci eşləşmə
// birincinin upcomingCall-unun üstünə səssizcə minir, birinci blokun member
// sənədi isə "matched" qalır — şagird iki yerdə gözlənilir, birində görünür.
// teacherSetMatch bu vəziyyəti onsuz da 409 ilə rədd edirdi; avtomatik yolda
// isə heç bir yoxlama yox idi. Səhv cütləşmələrin kökü budur.
//
// Niyə YALNIZ həmin gün: bir gündə iki fərqli saatda danışmaq real ssenaridir
// deyil — bir zəngi olan adam həmin günün qalan saatlarında artıq gözlənilməz.
// Sabahkı və o biri günlərin seçimlərinə TOXUNULMUR.
//
// Niyə yalnız "waiting" sətirlər: "matched" bir sətri silmək BAŞQA birinin
// randevusunu dağıdardı. Belə sətir varsa (köhnə məlumatda ikiqat rezervasiya
// qalıbsa) ona dəymirik — orada qərar insana aiddir.
//
// Tranzaksiyadan KƏNARDA, commit-dən sonra işləyir: hər blok üçün ayrı-ayrı
// oxu lazımdır və hamısını bir tranzaksiyaya yığmaq eşləşmənin özünü blokun
// üzv sayına görə sındırardı. Ən pis halda burada bir blok buraxılmamış qalır
// — bu, əvvəlki davranışdır, yəni geriyə doğru təhlükəsizdir.
async function releaseOtherSlotsSameDay(db, uid, keepSlotId) {
  const keep = parseSlotId(keepSlotId);
  if (!keep) return [];

  const uSnap = await db.collection("users").doc(uid).get().catch(() => null);
  if (!uSnap || !uSnap.exists) return [];
  const ids = (uSnap.data() || {}).practiceSlotIds || [];

  const targets = ids.filter((id) => {
    if (id === keepSlotId) return false;
    const p = parseSlotId(id);
    return !!p && p.date === keep.date && p.endMs > Date.now();
  });

  const released = [];
  for (const slotId of targets) {
    try {
      const done = await db.runTransaction(async (tx) => {
        const slotRef = db.collection("practiceSlots").doc(slotId);
        const membersRef = slotRef.collection("members");
        const snap = await tx.get(membersRef.limit(SLOT_MAX_MEMBERS));
        const members = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        const mine = members.find((m) => m.id === uid);
        if (!mine || mine.status !== "waiting") return false;

        tx.delete(membersRef.doc(uid));
        tx.set(db.collection("users").doc(uid), {
          practiceSlotIds: admin.firestore.FieldValue.arrayRemove(slotId),
        }, { merge: true });

        // Sayğaclar qalan üzvlərdən yenidən hesablanır (leavePracticeSlot ilə
        // eyni pattern) — increment zənciri sürüşsə də sənəd özünü bərpa edir.
        let waitingCount = 0;
        let matchedCount = 0;
        for (const m of members) {
          if (m.id === uid) continue;
          if (m.status === "waiting") waitingCount += 1;
          else if (m.status === "matched") matchedCount += 1;
        }
        tx.set(slotRef, {
          waitingCount, matchedCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
      });
      if (done) released.push(slotId);
    } catch (e) {
      console.warn("[releaseOtherSlotsSameDay]", slotId, e.message);
    }
  }
  return released;
}

exports.joinPracticeSlot = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const slot = parseSlotId(req.body && req.body.slotId);
  if (!slot) return res.status(400).json({ error: "invalid-slot" });

  const now = Date.now();
  // Bitmiş bloka qoşulmaq mənasızdır; üfüqdən kənar slot lövhədə görünmür.
  if (slot.endMs <= now) return res.status(400).json({ error: "slot-past" });
  if (slot.startMs > now + SLOT_HORIZON_DAYS * DAY_MS) {
    return res.status(400).json({ error: "slot-too-far" });
  }

  const db = admin.firestore();

  try {
    await enforceRateLimit(uid, "practiceSlot", 60, 60 * 60 * 1000);

    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(db.collection("users").doc(uid));
      if (!userSnap.exists) throw Object.assign(new Error("user-not-found"), { httpStatus: 404 });
      return joinSlotTx(db, tx, slot, uid, userSnap.data() || {});
    });

    if (result.matched) {
      const meSnap = await db.collection("users").doc(uid).get();
      const me = meSnap.exists ? meSnap.data() : {};
      const myRank = cefrRank(me.level);
      const peerRank = cefrRank(result.partnerLevel);
      await Promise.all([
        sendPushToUser(db, uid, slotMatchPush(slot.startMs, result.partnerName, myRank, peerRank)),
        sendPushToUser(db, result.partnerId, slotMatchPush(slot.startMs, me.name, peerRank, myRank)),
      ]).catch(() => null);

      // Hər iki tərəf üçün həmin günün qalan blokları buraxılır. Bloklar
      // lövhədən səssizcə yox olmasın deyə buraxılan tərəfə ayrıca bildiriş
      // gedir — yalnız HƏQİQƏTƏN nəsə buraxılıbsa.
      for (const who of [uid, result.partnerId]) {
        const freed = await releaseOtherSlotsSameDay(db, who, slot.slotId);
        if (freed.length > 0) {
          await sendPushToUser(db, who, {
            key: "slot_day_cleared",
            vars: { at: slot.startMs },
            type: "slot_day_cleared",
            url: "/",
          }).catch(() => null);
        }
      }
    } else if (!result.already) {
      // Tək qaldıq — həmin gün başqa blokda tək gözləyənlərə xəbər ver.
      await nudgeLoneWaiters(db, slot, uid);
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[joinPracticeSlot]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

exports.leavePracticeSlot = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const slot = parseSlotId(req.body && req.body.slotId);
  if (!slot) return res.status(400).json({ error: "invalid-slot" });

  const db = admin.firestore();

  try {
    await enforceRateLimit(uid, "practiceSlot", 60, 60 * 60 * 1000);

    const released = await db.runTransaction(async (tx) => {
      const slotRef = db.collection("practiceSlots").doc(slot.slotId);
      const membersRef = slotRef.collection("members");
      const membersSnap = await tx.get(membersRef.limit(SLOT_MAX_MEMBERS));
      const members = membersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

      const mine = members.find((m) => m.id === uid);
      if (!mine) return null;
      const partnerId = mine.pairedWith || null;
      const others = members.filter((m) => m.id !== uid);
      // Azad olan tərəf üçün blokda başqa gözləyən varsa, DƏRHAL yeni cüt
      // qurulur. Bunsuz iki nəfər eyni blokda "gözləyir" statusunda qalıb
      // bir-birini heç vaxt görmürdü — koordinasiya probleminin özü qayıdırdı.
      const partner = partnerId ? others.find((m) => m.id === partnerId) : null;
      const rematch = partner
        ? others.find((m) => m.id !== partnerId && m.status === "waiting") || null
        : null;

      const usersCol = db.collection("users");
      const del = admin.firestore.FieldValue.delete();
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.delete(membersRef.doc(uid));
      tx.set(usersCol.doc(uid), {
        practiceSlotIds: admin.firestore.FieldValue.arrayRemove(slot.slotId),
        // upcomingCall yalnız BU slota aiddirsə silinir — başqa blokdakı
        // randevu təsadüfən uçmasın.
        ...(mine.status === "matched" ? { upcomingCall: del } : {}),
      }, { merge: true });

      if (partner && rematch) {
        const newCallId = callIdForPair(partnerId, rematch.id);
        const sorted = [partnerId, rematch.id].sort();
        for (const [a, b] of [[partnerId, rematch], [rematch.id, partner]]) {
          tx.set(membersRef.doc(a), { status: "matched", pairedWith: b.id, callId: newCallId }, { merge: true });
          tx.set(usersCol.doc(a), {
            upcomingCall: {
              slotId: slot.slotId, startMs: slot.startMs,
              peerUid: b.id, peerName: b.name || "", callId: newCallId,
            },
          }, { merge: true });
        }
        tx.set(db.collection("calls").doc(newCallId), {
          userA: sorted[0], userB: sorted[1],
          callerId: partnerId, receiverId: rematch.id,
          status: "accepted", source: "slot_match",
          slotId: slot.slotId, createdAt: now,
        }, { merge: true });
      } else if (partner) {
        tx.set(membersRef.doc(partnerId), {
          status: "waiting", pairedWith: del, callId: del,
        }, { merge: true });
        tx.set(usersCol.doc(partnerId), { upcomingCall: del }, { merge: true });
      }

      // Sayğaclar son vəziyyətdən yenidən hesablanır — increment zənciri
      // sürüşsə də sənəd özünü bərpa edir.
      let waitingCount = 0;
      let matchedCount = 0;
      for (const m of others) {
        let status = m.status;
        if (partner && m.id === partnerId) status = rematch ? "matched" : "waiting";
        else if (rematch && m.id === rematch.id) status = "matched";
        if (status === "waiting") waitingCount += 1;
        else if (status === "matched") matchedCount += 1;
      }
      tx.set(slotRef, { waitingCount, matchedCount, updatedAt: now }, { merge: true });

      return {
        partnerId,
        partnerName: partner ? (partner.name || "") : "",
        rematchId: rematch ? rematch.id : null,
        rematchName: rematch ? (rematch.name || "") : "",
      };
    });

    if (released && released.partnerId) {
      if (released.rematchId) {
        // Yeni cüt quruldu — "planı dəyişdi" mesajı yanlış olardı, birbaşa
        // təsdiq göndərilir.
        await Promise.all([
          sendPushToUser(db, released.partnerId, {
            key: "slot_matched",
            vars: { at: slot.startMs, peerName: released.rematchName },
            type: "slot_matched", url: "/",
          }),
          sendPushToUser(db, released.rematchId, {
            key: "slot_matched",
            vars: { at: slot.startMs, peerName: released.partnerName },
            type: "slot_matched", url: "/",
          }),
        ]).catch(() => null);
      } else {
        // ÜZÜ QORUYAN mətn: rədd olunma və ad KEÇMİR. "X səni rədd etdi" hissi
        // istifadəçini tətbiqdən uzaqlaşdırır — bax plan sənədindəki qərar.
        await sendPushToUser(db, released.partnerId, {
          key: "slot_released",
          vars: { at: slot.startMs },
          type: "slot_released", url: "/",
        }).catch(() => null);
      }
    }

    return res.status(200).json({
      ok: true,
      released: !!(released && released.partnerId),
      rematched: !!(released && released.rematchId),
    });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[leavePracticeSlot]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// Təkrarlanan qrafik: "hər gün 14:00" / "hər Çərşənbə 20:00". Bir dəfə qurulur,
// planlaşdırıcı hər gün növbəti günləri özü doldurur — lövhə iki həftədən sonra
// özü-özünü doldurur və heç kim hər gün yenidən vaxt seçmir.
exports.setRecurringSlots = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const raw = (req.body && req.body.recurringSlots) || [];
  if (!Array.isArray(raw)) return res.status(400).json({ error: "invalid-schedule" });

  const seen = new Set();
  const recurringSlots = [];
  for (const item of raw) {
    const hour = Number(item && item.hour);
    const day = item && item.day;
    const dayOk = day === "daily" || (Number.isInteger(Number(day)) && Number(day) >= 0 && Number(day) <= 6);
    if (!SLOT_BLOCK_HOURS.includes(hour) || !dayOk) continue;
    const key = `${day}-${hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recurringSlots.push({ day: day === "daily" ? "daily" : Number(day), hour });
    if (recurringSlots.length >= 14) break;
  }

  try {
    await enforceRateLimit(decoded.uid, "practiceSlot", 60, 60 * 60 * 1000);
    await admin.firestore().collection("users").doc(decoded.uid)
      .set({ recurringSlots }, { merge: true });
    return res.status(200).json({ ok: true, recurringSlots });
  } catch (e) {
    if (e.httpStatus !== 429) console.error("[setRecurringSlots]", e.message);
    return res.status(e.httpStatus || 500).json({ error: e.message });
  }
});

// ─── Randevu vaxtının dəyişdirilməsi (qarşı tərəfin razılığı ilə) ──
// Vaxtı təkbaşına dəyişmək olmaz: randevunun bütün dəyəri qarşı tərəfin ona
// güvənməsidir. Ona görə axın təklif → razılıq şəklindədir. Rədd halında heç
// nə dəyişmir və KÖHNƏ randevu olduğu kimi qalır — yəni "yox" demək zəngi
// itirmək demək deyil, bu da rədd etməyi asanlaşdırır.
exports.proposeSlotChange = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const from = parseSlotId(req.body && req.body.fromSlotId);
  const to = parseSlotId(req.body && req.body.toSlotId);
  if (!from || !to) return res.status(400).json({ error: "invalid-slot" });
  if (from.slotId === to.slotId) return res.status(400).json({ error: "same-slot" });

  const now = Date.now();
  if (to.endMs <= now) return res.status(400).json({ error: "slot-past" });
  if (to.startMs > now + SLOT_HORIZON_DAYS * DAY_MS) {
    return res.status(400).json({ error: "slot-too-far" });
  }

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(uid, "slotChange", 20, 60 * 60 * 1000);

    const meRef = db.collection("practiceSlots").doc(from.slotId).collection("members").doc(uid);
    const meSnap = await meRef.get();
    if (!meSnap.exists) throw fail(404, "not-in-slot");
    const me = meSnap.data() || {};
    if (me.status !== "matched" || !me.pairedWith) throw fail(409, "not-matched");

    // Hədəf blokda tərəflərdən biri onsuz da varsa köçürmə mürəkkəbləşir
    // (orada başqası ilə cütləşmiş ola bilər) — bu halı sadəcə rədd edirik.
    const targetMembers = db.collection("practiceSlots").doc(to.slotId).collection("members");
    const [meThere, peerThere] = await Promise.all([
      targetMembers.doc(uid).get(),
      targetMembers.doc(me.pairedWith).get(),
    ]);
    if (meThere.exists || peerThere.exists) throw fail(409, "already-in-target");

    const requestId = `${from.slotId}_${uid}`;
    await db.collection("slotChanges").doc(requestId).set({
      fromSlotId: from.slotId,
      toSlotId: to.slotId,
      proposerUid: uid,
      proposerName: me.name || "",
      peerUid: me.pairedWith,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendPushToUser(db, me.pairedWith, {
      key: "slot_change_request",
      vars: { at: to.startMs, peerName: me.name },
      type: "slot_change_request",
      url: "/",
    }).catch(() => null);

    return res.status(200).json({ ok: true, requestId });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[proposeSlotChange]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

exports.respondSlotChange = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const uid = decoded.uid;
  const { requestId, accept } = req.body || {};
  if (!requestId || typeof requestId !== "string") {
    return res.status(400).json({ error: "invalid-request" });
  }

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    await enforceRateLimit(uid, "slotChange", 20, 60 * 60 * 1000);

    const result = await db.runTransaction(async (tx) => {
      const reqRef = db.collection("slotChanges").doc(requestId);
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) throw fail(404, "request-not-found");
      const r = reqSnap.data() || {};
      if (r.peerUid !== uid) throw fail(403, "not-your-request");
      if (r.status !== "pending") throw fail(409, "already-answered");

      const now = admin.firestore.FieldValue.serverTimestamp();

      if (accept !== true) {
        tx.update(reqRef, { status: "declined", respondedAt: now });
        return { accepted: false, proposerUid: r.proposerUid, toSlotId: r.toSlotId };
      }

      const from = parseSlotId(r.fromSlotId);
      const to = parseSlotId(r.toSlotId);
      if (!from || !to) throw fail(400, "invalid-slot");
      if (to.endMs <= Date.now()) throw fail(400, "slot-past");

      const fromRef = db.collection("practiceSlots").doc(from.slotId);
      const toRef = db.collection("practiceSlots").doc(to.slotId);
      const [fromMembersSnap, toMembersSnap] = await Promise.all([
        tx.get(fromRef.collection("members").limit(SLOT_MAX_MEMBERS)),
        tx.get(toRef.collection("members").limit(SLOT_MAX_MEMBERS)),
      ]);
      const fromMembers = fromMembersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const toMembers = toMembersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

      const a = fromMembers.find((m) => m.id === r.proposerUid);
      const b = fromMembers.find((m) => m.id === uid);
      if (!a || !b || a.pairedWith !== uid || b.pairedWith !== r.proposerUid) {
        // Aralıqda biri ləğv edibsə köçürüləcək cüt yoxdur.
        throw fail(409, "pair-gone");
      }

      const callId = callIdForPair(a.id, b.id);
      const usersCol = db.collection("users");

      // Köhnə blokdan çıxar.
      tx.delete(fromRef.collection("members").doc(a.id));
      tx.delete(fromRef.collection("members").doc(b.id));
      const fromOthers = fromMembers.filter((m) => m.id !== a.id && m.id !== b.id);
      tx.set(fromRef, {
        waitingCount: fromOthers.filter((m) => m.status === "waiting").length,
        matchedCount: fromOthers.filter((m) => m.status === "matched").length,
        updatedAt: now,
      }, { merge: true });

      // Yeni bloka cüt olaraq köçür. Hədəfdə gözləyən varsa o, gözləməkdə
      // qalır — bu cüt artıq bir-birinə bağlıdır.
      for (const [x, y] of [[a, b], [b, a]]) {
        tx.set(toRef.collection("members").doc(x.id), {
          uid: x.id, name: x.name || "", level: x.level || null,
          joinedAt: now, status: "matched", pairedWith: y.id, callId,
        });
        tx.set(usersCol.doc(x.id), {
          practiceSlotIds: admin.firestore.FieldValue.arrayRemove(from.slotId),
        }, { merge: true });
        tx.set(usersCol.doc(x.id), {
          practiceSlotIds: admin.firestore.FieldValue.arrayUnion(to.slotId),
          upcomingCall: {
            slotId: to.slotId, startMs: to.startMs,
            peerUid: y.id, peerName: y.name || "", callId,
          },
        }, { merge: true });
      }
      tx.set(toRef, {
        date: to.date, startHour: to.hour, startMs: to.startMs,
        waitingCount: toMembers.filter((m) => m.status === "waiting").length,
        matchedCount: toMembers.filter((m) => m.status === "matched").length + 2,
        updatedAt: now,
      }, { merge: true });

      tx.set(db.collection("calls").doc(callId), { slotId: to.slotId }, { merge: true });
      tx.update(reqRef, { status: "accepted", respondedAt: now });

      return { accepted: true, proposerUid: r.proposerUid, toSlotId: r.toSlotId };
    });

    const to = parseSlotId(result.toSlotId);
    await sendPushToUser(db, result.proposerUid, result.accepted
      ? {
        key: "slot_change_accepted",
        vars: { at: to ? to.startMs : undefined },
        type: "slot_change_accepted", url: "/",
      }
      : {
        key: "slot_change_declined",
        type: "slot_change_declined", url: "/",
      }).catch(() => null);

    return res.status(200).json({ ok: true, accepted: result.accepted });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[respondSlotChange]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// ─── Müəllim əl ilə zəng təyin edir ─────────────────────────────
// The board pairs whoever happens to land in the same block. A teacher needs
// the opposite: "these two, at this hour" — a weak student with a stronger one,
// two people preparing the same exam, a pair who missed each other last week.
//
// This is the ONLY write path that creates a pair without both sides opting in,
// so it is fenced on three sides: the caller must be a teacher, BOTH students
// must be on that teacher's roster, and neither may already owe a call at
// another time. It reuses joinSlotTx's data shapes exactly — member docs,
// upcomingCall, calls/{callId} with status "accepted" — so from the students'
// phones a teacher-set call is indistinguishable from a self-booked one and
// every downstream path (reminder, no-show janitor, leave, slot change) keeps
// working with no special case.
// Səhv qurulmuş cütü sökür — müəllim və ya admin üçün.
//
// Buna ehtiyac teacherSetMatch-in ÖZ qorumasından doğur: hər iki şagird boş
// olmalıdır, yoxsa 409 "student-a-busy". Yəni səhv cüt yarananda müəllim onun
// üstündən düzgün cütü YAZA BİLMİRDİ — əvvəlcə sökmək lazımdır, sökmək üçünsə
// heç bir yol yox idi. Bu funksiya həmin boşluğu bağlayır.
//
// Nə edir: hər ikisini "waiting"-ə qaytarır, upcomingCall-larını silir, zəng
// sənədini ləğv edir. Blokdan ÇIXARMIR — şagird həmin saatda boş qalmaq
// istəyir, sadəcə bu partnyorla yox. Avtomatik rematch QƏSDƏN edilmir:
// leavePracticeSlot azad olanı dərhal başqası ilə cütləşdirir, burada isə
// niyyət məhz "bu cüt olmasın"dır — dərhal yeni cüt qurmaq müəllimin düzgün
// cütü təyin etməsinə mane olardı.
//
// İcazə: admin hər cütü söküb bilər; müəllim isə cütdə ƏN AZI BİR şagirdi
// ona bağlıdırsa. Qarşı tərəf zərər görmür — blokda qalır və yenidən
// eşləşə bilər.
exports.cancelSlotMatch = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  const callerUid = decoded.uid;
  const { slotId, studentUid } = req.body || {};
  if (!slotId || typeof slotId !== "string") return res.status(400).json({ error: "invalid-slot" });
  if (!studentUid || typeof studentUid !== "string") return res.status(400).json({ error: "invalid-student" });

  const slot = parseSlotId(slotId);
  if (!slot) return res.status(400).json({ error: "invalid-slot" });

  const db = admin.firestore();

  try {
    await enforceRateLimit(callerUid, "cancelSlotMatch", 60, 24 * 60 * 60 * 1000);

    const result = await db.runTransaction(async (tx) => {
      const slotRef = db.collection("practiceSlots").doc(slotId);
      const membersRef = slotRef.collection("members");
      const membersSnap = await tx.get(membersRef.limit(SLOT_MAX_MEMBERS));
      const members = membersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

      const mine = members.find((m) => m.id === studentUid);
      if (!mine) throw Object.assign(new Error("not-in-slot"), { httpStatus: 404 });
      if (mine.status !== "matched" || !mine.pairedWith) {
        throw Object.assign(new Error("not-matched"), { httpStatus: 409 });
      }
      const peerId = mine.pairedWith;

      // İcazə yoxlaması oxu mərhələsindədir — tranzaksiyada bütün oxular
      // yazılardan ƏVVƏL olmalıdır.
      const isAdminCaller = callerUid === ADMIN_UID;
      let allowed = isAdminCaller;
      let byName = "";
      const [aSnap, bSnap, callerSnap] = await Promise.all([
        tx.get(db.collection("users").doc(studentUid)),
        tx.get(db.collection("users").doc(peerId)),
        tx.get(db.collection("users").doc(callerUid)),
      ]);
      byName = (callerSnap.exists ? (callerSnap.data() || {}).name : "") || "";
      if (!allowed) {
        const a = aSnap.exists ? aSnap.data() || {} : {};
        const b = bSnap.exists ? bSnap.data() || {} : {};
        allowed = a.teacherId === callerUid || b.teacherId === callerUid;
      }
      if (!allowed) throw Object.assign(new Error("not-your-student"), { httpStatus: 403 });

      const del = admin.firestore.FieldValue.delete();
      const usersCol = db.collection("users");

      for (const id of [studentUid, peerId]) {
        tx.set(membersRef.doc(id), { status: "waiting", pairedWith: del, callId: del }, { merge: true });
        tx.set(usersCol.doc(id), { upcomingCall: del }, { merge: true });
      }

      if (mine.callId) {
        tx.set(db.collection("calls").doc(mine.callId), {
          status: "cancelled",
          cancelledBy: callerUid,
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      let waitingCount = 0;
      let matchedCount = 0;
      for (const m of members) {
        const status = (m.id === studentUid || m.id === peerId) ? "waiting" : m.status;
        if (status === "waiting") waitingCount += 1;
        else if (status === "matched") matchedCount += 1;
      }
      tx.set(slotRef, {
        waitingCount, matchedCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { peerId, byName };
    });

    await Promise.all([studentUid, result.peerId].map((id) => sendPushToUser(db, id, {
      key: "slot_match_cancelled",
      vars: { at: slot.startMs, byName: result.byName },
      type: "slot_match_cancelled", url: "/",
    }))).catch(() => null);

    return res.status(200).json({ ok: true, peerId: result.peerId });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[cancelSlotMatch]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

exports.teacherSetMatch = onRequest({ secrets: [], invoker: "public" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
  const teacherUid = decoded.uid;

  const body = req.body || {};
  const uidA = String(body.studentA || body.studentA_uid || "").trim();
  const uidB = String(body.studentB || body.studentB_uid || "").trim();
  if (!uidA || !uidB || uidA.length > 128 || uidB.length > 128) {
    return res.status(400).json({ error: "invalid-student" });
  }
  if (uidA === uidB) return res.status(400).json({ error: "same-student" });
  if (uidA === teacherUid || uidB === teacherUid) {
    return res.status(400).json({ error: "invalid-student" });
  }

  const slot = parseSlotId(body.slotId);
  if (!slot) return res.status(400).json({ error: "invalid-slot" });

  const now = Date.now();
  if (slot.endMs <= now) return res.status(400).json({ error: "slot-past" });
  if (slot.startMs > now + SLOT_HORIZON_DAYS * DAY_MS) {
    return res.status(400).json({ error: "slot-too-far" });
  }

  const db = admin.firestore();
  const fail = (status, message) => Object.assign(new Error(message), { httpStatus: status });

  try {
    // Same ceiling as nudgeStudent: far above any real class, still bounded.
    await enforceRateLimit(teacherUid, "teacherSetMatch", 40, 24 * 60 * 60 * 1000);

    const result = await db.runTransaction(async (tx) => {
      const usersCol = db.collection("users");
      const [teacherSnap, aSnap, bSnap] = await Promise.all([
        tx.get(usersCol.doc(teacherUid)),
        tx.get(usersCol.doc(uidA)),
        tx.get(usersCol.doc(uidB)),
      ]);

      const teacher = teacherSnap.exists ? (teacherSnap.data() || {}) : {};
      if (teacher.role !== "teacher" && teacher.teacherEligible !== true) {
        throw fail(403, "not-a-teacher");
      }
      if (!aSnap.exists || !bSnap.exists) throw fail(404, "student-not-found");

      const a = aSnap.data() || {};
      const b = bSnap.data() || {};
      // A teacher may only schedule for their OWN students. Without this the
      // endpoint would let any teacher account pair two arbitrary strangers.
      if (a.teacherId !== teacherUid || b.teacherId !== teacherUid) {
        throw fail(403, "not-your-student");
      }

      // ── Double-booking guard ──────────────────────────────────
      // upcomingCall is a SINGLE field on the user document, so a student can
      // only owe one call at a time. Writing a second one would silently
      // overwrite the first while leaving the other slot's member doc matched
      // — the student would then be expected in two places and shown in one.
      // A call in this same block is fine (it is the one we are about to
      // replace); one anywhere else is refused, and the teacher is told who.
      const clashes = (u) => {
        const uc = u.upcomingCall;
        if (!uc || uc.slotId === slot.slotId) return false;
        const other = parseSlotId(uc.slotId);
        return !!other && other.endMs > now;
      };
      if (clashes(a)) throw fail(409, "student-a-busy");
      if (clashes(b)) throw fail(409, "student-b-busy");

      const slotRef = db.collection("practiceSlots").doc(slot.slotId);
      const membersRef = slotRef.collection("members");
      const membersSnap = await tx.get(membersRef.limit(SLOT_MAX_MEMBERS));
      const members = membersSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

      const memA = members.find((m) => m.id === uidA) || null;
      const memB = members.find((m) => m.id === uidB) || null;
      // Already exactly this pair? Nothing to write, and above all nothing to
      // notify — a teacher pressing the button twice must not push twice.
      if (memA && memB && memA.pairedWith === uidB && memB.pairedWith === uidA) {
        return { alreadyPaired: true, released: [] };
      }

      const now2 = admin.firestore.FieldValue.serverTimestamp();
      const del = admin.firestore.FieldValue.delete();
      const callId = callIdForPair(uidA, uidB);
      const sorted = [uidA, uidB].sort();

      // ── Release whoever these two were paired with IN THIS BLOCK ──
      // They go back to "waiting" rather than being dropped: they still said
      // they were free at this hour, and the next joiner can take them.
      const released = [];
      for (const mem of [memA, memB]) {
        const exPartnerId = mem && mem.pairedWith;
        if (!exPartnerId || exPartnerId === uidA || exPartnerId === uidB) continue;
        released.push(exPartnerId);
        tx.set(membersRef.doc(exPartnerId), {
          status: "waiting", pairedWith: del, callId: del,
        }, { merge: true });
        tx.set(usersCol.doc(exPartnerId), { upcomingCall: del }, { merge: true });
        if (mem.callId) {
          tx.set(db.collection("calls").doc(mem.callId), { status: "cancelled" }, { merge: true });
        }
      }

      // ── Write the pair ────────────────────────────────────────
      for (const [uid, u, mem, peerUid, peer] of [
        [uidA, a, memA, uidB, b],
        [uidB, b, memB, uidA, a],
      ]) {
        tx.set(membersRef.doc(uid), {
          uid,
          name: u.name || "",
          level: u.level || null,
          // A member who was already in the block keeps their original
          // joinedAt; only a newly added one is stamped now.
          ...(mem ? {} : { joinedAt: now2 }),
          status: "matched",
          pairedWith: peerUid,
          callId,
          setByTeacher: teacherUid,
        }, { merge: true });

        tx.set(usersCol.doc(uid), {
          practiceSlotIds: admin.firestore.FieldValue.arrayUnion(slot.slotId),
          upcomingCall: {
            slotId: slot.slotId, startMs: slot.startMs,
            peerUid, peerName: peer.name || "", callId,
            setByTeacher: teacherUid,
          },
        }, { merge: true });
      }

      // status "accepted", not "calling": the appointment is in the FUTURE, so
      // nobody's phone may ring now (see the same note in joinSlotTx).
      tx.set(db.collection("calls").doc(callId), {
        userA: sorted[0], userB: sorted[1],
        callerId: uidA, receiverId: uidB,
        status: "accepted", source: "teacher_match",
        slotId: slot.slotId, setByTeacher: teacherUid, createdAt: now2,
      }, { merge: true });

      // Counters recomputed from the FINAL state rather than incremented —
      // the same self-healing pattern leavePracticeSlot uses, and the reason
      // an increment-by-2 would have been wrong here: either student may
      // already have been counted as waiting in this block.
      const finalStatus = new Map(members.map((m) => [m.id, m.status]));
      released.forEach((id) => finalStatus.set(id, "waiting"));
      finalStatus.set(uidA, "matched");
      finalStatus.set(uidB, "matched");
      let waitingCount = 0;
      let matchedCount = 0;
      for (const st of finalStatus.values()) {
        if (st === "waiting") waitingCount += 1;
        else if (st === "matched") matchedCount += 1;
      }
      tx.set(slotRef, {
        date: slot.date, startHour: slot.hour, startMs: slot.startMs,
        waitingCount, matchedCount, updatedAt: now2,
      }, { merge: true });

      return {
        alreadyPaired: false,
        released,
        callId,
        nameA: a.name || "",
        nameB: b.name || "",
        teacherName: teacher.name || "",
      };
    });

    if (!result.alreadyPaired) {
      // Pushes go out AFTER the commit (a transaction can retry; a push cannot
      // be un-sent). Each is resolved in its own recipient's language and
      // timezone by sendPushToUser.
      const teacherName = result.teacherName;
      await Promise.all([
        sendPushToUser(db, uidA, {
          key: "teacher_scheduled_call",
          vars: { at: slot.startMs, peerName: result.nameB, teacherName },
          type: "teacher_scheduled_call", url: "/",
        }),
        sendPushToUser(db, uidB, {
          key: "teacher_scheduled_call",
          vars: { at: slot.startMs, peerName: result.nameA, teacherName },
          type: "teacher_scheduled_call", url: "/",
        }),
        ...result.released.map((id) => sendPushToUser(db, id, {
          key: "slot_released",
          vars: { at: slot.startMs },
          type: "slot_released", url: "/",
        })),
      ]).catch(() => null);

      // Əl ilə qurulan cüt də avtomatik cüt qədər "məşğuldur" — həmin günün
      // qalan blokları eyni qayda ilə buraxılır, yoxsa müəllimin təyin etdiyi
      // şagird başqa blokda yenidən tutula bilərdi.
      for (const who of [uidA, uidB]) {
        const freed = await releaseOtherSlotsSameDay(db, who, slot.slotId);
        if (freed.length > 0) {
          await sendPushToUser(db, who, {
            key: "slot_day_cleared",
            vars: { at: slot.startMs },
            type: "slot_day_cleared", url: "/",
          }).catch(() => null);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      alreadyPaired: !!result.alreadyPaired,
      callId: result.callId || null,
      released: result.released.length,
    });
  } catch (e) {
    const status = e.httpStatus || 500;
    if (status === 500) console.error("[teacherSetMatch]", e.message);
    return res.status(status).json({ error: e.message });
  }
});

// Bir dəfə iddia edilən marker — eyni push hər dəqiqə təkrarlanmasın deyə.
// matchSessionQueue-dakı sessionRuns pattern-inin eynisi.
async function claimSlotRun(db, id) {
  const ref = db.collection("slotRuns").doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return false;
    tx.set(ref, { at: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

exports.practiceSlotTick = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Asia/Baku" },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const today = bakuDateStr(now);
    const dates = [];
    for (let i = 0; i < SLOT_HORIZON_DAYS; i++) dates.push(bakuDateStr(now + i * DAY_MS));

    // ① Gündə bir dəfə: təkrarlanan qrafikləri materiallaşdır + köhnəni təmizlə.
    if (await claimSlotRun(db, `${today}_daily`)) {
      try {
        const usersSnap = await db.collection("users").get();
        for (const uDoc of usersSnap.docs) {
          const u = uDoc.data() || {};
          // Janitor: bloku artıq bitmiş upcomingCall ilişib qalmasın. Blok-bağlama
          // keçidi yalnız bugün/sabah pəncərəsini işləyir, ona görə köhnə
          // (keçmiş günlərdən qalan) randevular bura düşür və gündə bir dəfə silinir.
          const uc = u.upcomingCall;
          if (uc && uc.slotId) {
            const ucSlot = parseSlotId(uc.slotId);
            if (ucSlot && ucSlot.startMs + SLOT_BLOCK_MS < now) {
              await uDoc.ref.set(
                { upcomingCall: admin.firestore.FieldValue.delete() }, { merge: true },
              ).catch(() => null);
            }
          }
          const rec = Array.isArray(u.recurringSlots) ? u.recurringSlots : [];
          if (rec.length === 0) continue;
          for (const dateStr of dates) {
            const wd = bakuWeekday(dateStr);
            for (const r of rec) {
              if (r.day !== "daily" && Number(r.day) !== wd) continue;
              const slot = parseSlotId(slotIdOf(dateStr, r.hour));
              if (!slot || slot.endMs <= now) continue;
              try {
                await db.runTransaction((tx) => joinSlotTx(db, tx, slot, uDoc.id, u));
              } catch (e) {
                console.warn("[SlotTick] recurring join failed:", uDoc.id, slot.slotId, e.message);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[SlotTick] materialize failed:", e.message);
      }

      // Keçmiş slotları sil (sənəd + üzvlər). Yalnız TAM tarixlə sorğu —
      // kolleksiya yolu ilə toplu silmə heç vaxt.
      try {
        const oldDate = bakuDateStr(now - 2 * DAY_MS);
        const oldSnap = await db.collection("practiceSlots").where("date", "<", oldDate).limit(200).get();
        for (const d of oldSnap.docs) {
          const mem = await d.ref.collection("members").limit(SLOT_MAX_MEMBERS).get();
          await Promise.all(mem.docs.map((m) => m.ref.delete()));
          await d.ref.delete();
        }
      } catch (e) {
        console.warn("[SlotTick] cleanup failed:", e.message);
      }
    }

    // ② Xatırlatma / başlanğıc / no-show — bu gün və sabahın blokları bəsdir.
    const window = [...new Set([dates[0], dates[1]].filter(Boolean))];
    const slotsSnap = await db.collection("practiceSlots").where("date", "in", window).get();

    for (const doc of slotsSnap.docs) {
      const slot = parseSlotId(doc.id);
      if (!slot) continue;
      const untilStart = slot.startMs - now;

      const matchedMembers = async () => {
        const snap = await doc.ref.collection("members")
          .where("status", "==", "matched").limit(SLOT_MAX_MEMBERS).get();
        return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      };

      try {
        // 10 dəqiqə qalmış xatırlatma. Yalnız EŞLƏŞMİŞ üzvlərə — tək gözləyənə
        // "hələ təksən" yazmaq ruhdan salır və spam kimi oxunur.
        if (untilStart <= SLOT_REMINDER_MS && untilStart > SLOT_REMINDER_MS - 60000) {
          if (await claimSlotRun(db, `${doc.id}_reminder`)) {
            for (const m of await matchedMembers()) {
              await sendPushToUser(db, m.id, {
                key: "slot_reminder",
                vars: { at: slot.startMs },
                type: "slot_reminder", url: "/",
              }).catch(() => null);
            }
          }
        }

        // Randevu anı.
        if (untilStart <= 0 && untilStart > -60000) {
          if (await claimSlotRun(db, `${doc.id}_start`)) {
            for (const m of await matchedMembers()) {
              await sendPushToUser(db, m.id, {
                key: "slot_start",
                type: "slot_start", url: "/",
              }).catch(() => null);
            }
          }
        }

        // No-show: biri gəlib, digəri gəlməyibsə nəzakətli xatırlatma qoyulur.
        // Cəza YOXDUR — icma yeni formalaşır, ban insanları qaçırar.
        const sinceStart = now - slot.startMs;
        if (sinceStart >= SLOT_NOSHOW_GRACE_MS && sinceStart < SLOT_NOSHOW_GRACE_MS + 60000) {
          if (await claimSlotRun(db, `${doc.id}_noshow`)) {
            const members = await matchedMembers();
            const byId = new Map(members.map((m) => [m.id, m]));
            for (const m of members) {
              const peer = m.pairedWith ? byId.get(m.pairedWith) : null;
              if (!peer) continue;
              if (peer.arrivedAt && !m.arrivedAt) {
                await db.collection("users").doc(m.id).set({
                  missedSlots: admin.firestore.FieldValue.increment(1),
                  slotNoticePending: true,
                }, { merge: true });
              }
            }
          }
        }

        // Blok bitdi: randevu qapanır. upcomingCall əvvəllər YALNIZ əl ilə ləğvdə
        // silinirdi → heç kim qoşulmayan zəng həm home kartında, həm admin
        // panelində ilişib qalırdı. İndi blok bitəndə upcomingCall (yalnız BU
        // slota aid olanı) təmizlənir, ölü "accepted" zəng sənədi "expired"
        // edilir və heç kim qoşulmayan cütə nəzakətli xəbərdarlıq gedir.
        if (sinceStart >= SLOT_BLOCK_MS && sinceStart < SLOT_BLOCK_MS + 60000) {
          if (await claimSlotRun(db, `${doc.id}_close`)) {
            const members = await matchedMembers();
            const byId = new Map(members.map((m) => [m.id, m]));
            const del = admin.firestore.FieldValue.delete();
            for (const m of members) {
              const uref = db.collection("users").doc(m.id);
              const usnap = await uref.get();
              const uc = usnap.exists ? (usnap.data() || {}).upcomingCall : null;
              if (uc && uc.slotId === doc.id) {
                await uref.set({ upcomingCall: del }, { merge: true }).catch(() => null);
              }
              const peer = m.pairedWith ? byId.get(m.pairedWith) : null;
              const nobodyCame = !m.arrivedAt && (!peer || !peer.arrivedAt);
              if (nobodyCame) {
                await sendPushToUser(db, m.id, {
                  key: "slot_missed",
                  vars: { at: slot.startMs },
                  type: "slot_missed", url: "/",
                }).catch(() => null);
              }
              if (m.callId) {
                await db.collection("calls").doc(m.callId)
                  .set({ status: "expired" }, { merge: true }).catch(() => null);
              }
            }
          }
        }
      } catch (e) {
        console.warn("[SlotTick] slot pass failed:", doc.id, e.message);
      }
    }
  },
);

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
        model: GROQ_CHAT_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature,
        reasoning_effort: "low",
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
    const dgRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
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
const ANALYSIS_HOURLY_AUDIO_BUDGET = 21600; // 6 saat audio/saat — 50% analiz üçün 5760 çox dar idi

// İstifadəçinin ana dili — hesabatın yazıldığı dil. users/{uid}.preferredLanguage
// -dən gəlir; yoxdursa 'az'. Türkiyə bazarı üçün 'tr'.
// Hər dil üçün KONKRET yerli lövbərlər. Yalnız dil adını ("Azerbaijani")
// deməK kifayət etmir — model dil adını görüb uydurma orfoqrafiya yazır
// (istehsalatda müşahidə olunub: "çöräkli cümlléşé", ə əvəzinə é). Yerli
// başlıqlar + real L1 nümunəsi + hərf dəsti modeli düzgün yazıya bağlayır.
const LANGUAGE_GUIDE = {
  az: {
    name: "Azerbaijani",
    greeting: "Salam",
    strengths: "Güclü tərəflərin",
    growth: "İnkişaf sahələrin",
    address: "sən",
    letters: "ə, ı, ö, ü, ç, ş, ğ",
    l1: 'Azərbaycan dilində artikl yoxdur, ona görə "a/the" düşür: "I went to bazaar" ✗ → "I went to the bazaar" ✓',
    sample: "Keçmiş zaman formasını unutmusan — burada 'went' işlətmək lazımdır.",
    goodTitles: '"Am/Is/Are ilə əsas felin qarışdırılması", "Keçmiş zamanda felin ikinci formasının unudulması", "Sayıla bilən isimlərdə too much–too many qarışıqlığı"',
    badTitles: '"Zaman formaları", "Söz ehtiyatı", "Cümlə quruluşu"',
    goodRule: '"Cümlədə əsl fel varsa, am/is/are İŞLƏNMİR: I am go ✗ → I go ✓"',
  },
  tr: {
    name: "Turkish",
    greeting: "Merhaba",
    strengths: "Güçlü yönlerin",
    growth: "Gelişim alanların",
    address: "sen",
    letters: "ı, i, ö, ü, ç, ş, ğ",
    l1: 'Türkçede artikel yoktur, bu yüzden "a/the" düşer: "I went to bazaar" ✗ → "I went to the bazaar" ✓',
    sample: "Geçmiş zaman biçimini unutmuşsun — burada 'went' kullanman gerekiyor.",
    goodTitles: '"Am/Is/Are ile esas fiilin karıştırılması", "Geçmiş zamanda fiilin ikinci hâlinin unutulması", "Sayılabilen isimlerde too much–too many karışıklığı"',
    badTitles: '"Zaman biçimleri", "Söz varlığı", "Cümle yapısı"',
    goodRule: '"Cümlede eylem varsa am/is/are KULLANILMAZ: I am go ✗ → I go ✓"',
  },
};

// Geriyə uyğunluq: bəzi yerlərdə yalnız ad lazımdır.
const LANGUAGE_NAMES = { az: "Azerbaijani", tr: "Turkish" };

// Prompt-a dilə aid bütün lövbərləri yeridir.
function buildAnalysisPrompt(transcript, lang) {
  const g = LANGUAGE_GUIDE[lang] || LANGUAGE_GUIDE.az;
  return ANALYSIS_PROMPT
    .replace("{{TRANSCRIPT}}", transcript)
    .replace(/\{\{LANGUAGE\}\}/g, g.name)
    .replace(/\{\{GREETING\}\}/g, g.greeting)
    .replace(/\{\{H_STRENGTHS\}\}/g, g.strengths)
    .replace(/\{\{H_GROWTH\}\}/g, g.growth)
    .replace(/\{\{ADDRESS\}\}/g, g.address)
    .replace(/\{\{LETTERS\}\}/g, g.letters)
    .replace(/\{\{L1_EXAMPLE\}\}/g, g.l1)
    .replace(/\{\{SAMPLE\}\}/g, g.sample)
    .replace(/\{\{GOOD_TITLES\}\}/g, g.goodTitles)
    .replace(/\{\{BAD_TITLES\}\}/g, g.badTitles)
    .replace(/\{\{GOOD_RULE\}\}/g, g.goodRule);
}

const ANALYSIS_PROMPT = `You are an Elite Linguistic Analyst and Expert English Pedagogical Consultant. Your feedback is world-class: precise, deeply structured, and genuinely empathetic. You are also fluent in {{LANGUAGE}} and understand exactly which English mistakes {{LANGUAGE}} speakers make because of their mother tongue (L1 transfer). Two people will read your report: the learner themself and, possibly, their real teacher — it must be flawless for both.

TRANSCRIPT:
"""{{TRANSCRIPT}}"""

Return ONLY a valid JSON object. No text outside the JSON.

VOICE ({{LANGUAGE}} text fields):
- Write ALL feedback text in natural, warm, modern {{LANGUAGE}}, addressing the learner informally as "{{ADDRESS}}".
- ORTHOGRAPHY IS CRITICAL. Use correct {{LANGUAGE}} letters ({{LETTERS}}) and correct native spelling. Never invent word forms, never substitute look-alike accented letters, never output half-{{LANGUAGE}} gibberish. If unsure of a word, choose a simpler word you are certain about.
- This is the quality bar for every {{LANGUAGE}} sentence you write: "{{SAMPLE}}"
- The learner reads only {{LANGUAGE}}. Never mix in another language.
- SCRIPT LOCK: write using ONLY the {{LANGUAGE}} alphabet and plain English words. NEVER output Chinese, Japanese, Korean, Arabic or Cyrillic characters anywhere — not even a single word. If a concept is easier in another language, express it in {{LANGUAGE}} instead.
- Never address them as "teacher" or "pupil". Encourage like a brilliant mentor, never lecture, never sound clinical or robotic.

IGNORE MICROPHONE NOISE:
- The transcript is auto-generated and may contain garbled, non-English, or nonsensical tokens from mic noise (e.g. "Já, þess", random symbols, foreign gibberish). These are NOT things the learner said.
- Do NOT correct, mention, or put such noise anywhere. Analyze only the intelligible English speech and silently skip the rest.

HONESTY — THE MOST IMPORTANT RULE:
- NEVER invent a mistake. Every "original" you quote MUST be a real, near-verbatim phrase from the transcript above. It is checked automatically against the transcript and silently dropped if it is not there — a fabricated example simply disappears and makes your report worse.
- If the learner spoke well and made few real errors, report FEW errors. A short honest report beats a padded one.
- If there are no real errors at all, return an empty error_themes array and say so warmly in the report. Never manufacture a problem to fill space.
- Do not turn a correct sentence into a "mistake" by rewriting it in your preferred style.

Rules:
- Correct ONLY real grammatical or lexical mistakes. If a sentence is already correct, leave it alone.
- Never rewrite for style: do not swap "is not" for "isn't", do not reorder correct clauses, do not offer alternatives to correct sentences.
- error_themes: THIS IS THE HEART OF THE REPORT. Do not produce a flat list of unrelated fixes. Read the WHOLE transcript, find the PATTERNS the learner repeats, and group the errors into at most 5 named themes, strongest pattern first.
  Each theme = one recurring habit, e.g. "using am/is/are together with a main verb", "past tense forms", "countable vs uncountable quantifiers", "unnecessary preposition after a verb", "{{LANGUAGE}} word-for-word translation (L1 transfer)".
  - title: the theme name in {{LANGUAGE}} — name the ACTUAL structure, not a school subject.
    Titles MUST be written in {{LANGUAGE}} only — never borrow a word from a related language.
    GOOD: {{GOOD_TITLES}}
    BAD: {{BAD_TITLES}} — too broad to act on.
  - rule: ONE memorable, IMPERATIVE rule in {{LANGUAGE}} that prevents every error in this theme — a teacher's golden rule, not a description.
    GOOD: {{GOOD_RULE}}
    BAD: a vague description like "word choice is important" / "pay attention to tenses" — these teach nothing.
    Write the rule so that a learner who memorises just that one line stops making every error in this theme. If you show a wrong→right pair, use REAL English examples, never the placeholder symbols alone.
  - items: 1-4 real examples of THIS theme from the transcript. original = near-verbatim from the transcript; corrected = the fixed sentence; explanation = {{LANGUAGE}}, 1-2 sentences saying WHY, and naming the {{LANGUAGE}} interference when that is the cause. Example of the depth expected: {{L1_EXAMPLE}}
  - A theme with only ONE example is fine if the error is important. A theme with zero real examples must NOT exist.
- report_markdown: an Executive Summary in {{LANGUAGE}}, in Markdown, 120-180 words. CRITICAL: every heading and every bullet MUST be on its own line — put a real newline ("\\n") between them, never run them together on one line. Follow this exact skeleton:
"## 👋 {{GREETING}}!\\n\\n<one warm sentence referencing what they actually talked about>\\n\\n### 💪 {{H_STRENGTHS}}\\n- <concrete moment from THIS conversation>\\n- <another one>\\n\\n### 🌱 {{H_GROWTH}}\\n- **<pattern name>** — <one specific sentence>\\n- **<pattern name>** — <one specific sentence>\\n\\n<one short closing motivation sentence>"
  Use **bold** for key phrases. No headings other than these.
- scores: fluency = flow and natural delivery; grammar = correctness; vocabulary = range and level. Integers 0-100.
- recap: 1-2 sentences on what the learner talked about.
- strengths: 1-2 concrete things they genuinely did well in this conversation.
- tips: 2-3 NAMED practice techniques, each tied to a theme above. Give each one a short memorable name the learner can repeat to themselves, then one sentence on how to do it. Model them on: "Am/Is/Are detoksu — danışarkən cümlədə hərəkət varsa, am/is/are demədən keç." or "Kölgələmə (Shadowing) — videonu dayandır, eyni cümləni eyni ahənglə səsli təkrarla." No generic filler such as "qorxma" or "daha çox danış".
- vocabulary: 3-5 useful or slightly advanced words or phrases, each with a natural example sentence. Skip basic words.
- homework: personalized exercises built ONLY from the learner's ACTUAL mistakes in this transcript. Never invent mistakes they did not make. If there are no real mistakes, return empty arrays.
  - multiple_choice: up to 5 items. question = a short English sentence or gap-fill testing the exact pattern they got wrong (do not copy their sentence verbatim — same pattern, fresh example). options = exactly 3 plausible choices, one correct. correct_answer must be copied character-for-character from options. explanation = {{LANGUAGE}}, 1-2 sentences, deep and meaningful; explain L1 transfer where relevant.
  - word_order: up to 4 items. correct_sentence = a natural English sentence of 5-9 words practising a pattern they got wrong (their corrected sentence is ideal if short enough). scrambled = ALL words of correct_sentence in shuffled order, one word per array element, no punctuation-only elements. explanation = {{LANGUAGE}}, naming the specific grammar point this sentence practises (e.g. "past tense 'went'", "'for' + duration"). State ONLY rules that are true of English — never invent word-order rules (English is Subject-Verb-Object; the verb does NOT go at the end). If unsure, just name the tense or structure being practised.
- Every explanation must teach something concrete. Write natural, correct, modern {{LANGUAGE}} — if you are not sure a morphological form is right, use a simpler phrasing.
- recap, reason, strengths, tips and every explanation must be in {{LANGUAGE}}. word, example, question, options and English sentences stay in English.
- corrected sentences and example sentences must sound like simple, natural, modern native-speaker English.
- Base everything on the transcript; invent nothing about the conversation.
- Be encouraging and honest — celebrate real progress, point out real mistakes with warmth.`;

// Whisper can return very long transcripts; the JSON answer must still fit in
// the completion budget, so the model only sees a bounded slice.
const MAX_TRANSCRIPT_CHARS = 32000; // ~30 dəq nitq. 6000 idi: LLM yalnız ilk ~7 dəqiqəni görürdü

// Strict schema enforced at the Groq API level (structured outputs).
// maxItems is what keeps the completion bounded: with these caps a full answer
// (report + homework daxil) ~1600-2000 output token edir — ANALYSIS_MAX_TOKENS
// ona görə qaldırılıb.
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["report_markdown", "recap", "scores", "error_themes", "strengths", "tips", "vocabulary", "homework"],
  properties: {
    report_markdown: { type: "string" },
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
    // Səhvlər MÖVZUYA görə qruplaşdırılır — hesabatın "peşəkar" hissi məhz
    // buradan gəlir: fərdi düzəliş siyahısı yox, təkrarlanan naxışın adı +
    // bir qızıl qayda + həmin naxışın real nümunələri.
    error_themes: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "rule", "items"],
        properties: {
          title: { type: "string" },
          rule: { type: "string" },
          items: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["original", "corrected", "explanation"],
              properties: {
                original: { type: "string" },
                corrected: { type: "string" },
                explanation: { type: "string" },
              },
            },
          },
        },
      },
    },
    strengths: { type: "array", maxItems: 3, items: { type: "string" } },
    tips: { type: "array", maxItems: 3, items: { type: "string" } },
    vocabulary: {
      type: "array",
      maxItems: 5,
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
    homework: {
      type: "object",
      additionalProperties: false,
      required: ["multiple_choice", "word_order"],
      properties: {
        multiple_choice: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["question", "options", "correct_answer", "explanation"],
            properties: {
              question: { type: "string" },
              options: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
              correct_answer: { type: "string" },
              explanation: { type: "string" },
            },
          },
        },
        word_order: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["scrambled", "correct_sentence", "explanation"],
            properties: {
              scrambled: { type: "array", minItems: 2, maxItems: 12, items: { type: "string" } },
              correct_sentence: { type: "string" },
              explanation: { type: "string" },
            },
          },
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

  // ── Mövzu qrupları + UYDURMA YOXLAMASI ────────────────────────
  // Modelə "uydurma" deməK kifayət deyil — yoxlanılır. Sitat gətirilən hər
  // `original` transkriptdə HƏQİQƏTƏN olmalıdır; yoxdursa atılır. Bu, "AI
  // özündən hoqqa çıxarır" probleminin determinik həllidir.
  const normText = (v) => String(v || "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const haystack = normText(transcript);

  const quotedInTranscript = (original) => {
    const needle = normText(original);
    if (!needle) return false;
    if (haystack.includes(needle)) return true;
    // Model sitatı bir az təmizləyə bilər (dolğu sözlər, təkrarlar) — ona görə
    // tam uyğunluq tələb etmirik, sözlərin çoxu transkriptdə olmalıdır.
    const words = needle.split(" ").filter((w) => w.length > 2);
    if (words.length === 0) return haystack.includes(needle);
    const hits = words.filter((w) => haystack.includes(w)).length;
    return hits / words.length >= 0.7;
  };

  const themeItem = (f) => ({
    original: asStr(f?.original),
    corrected: asStr(f?.corrected),
    reason: asStr(f?.explanation) || asStr(f?.reason),
  });

  let invented = 0;
  const errorThemes = (Array.isArray(obj.error_themes) ? obj.error_themes : [])
    .map((t) => ({
      title: asStr(t?.title),
      rule: asStr(t?.rule),
      items: (Array.isArray(t?.items) ? t.items : [])
        .map(themeItem)
        .filter(isRealCorrection)
        .filter((it) => {
          const ok = quotedInTranscript(it.original);
          if (!ok) invented += 1;
          return ok;
        })
        .slice(0, 4),
    }))
    // Nümunəsi qalmayan mövzu göstərilmir — boş başlıq hesabatı zəiflədir.
    .filter((t) => t.title && t.items.length > 0)
    .slice(0, 5);

  if (invented > 0) {
    console.log("[Analysis] dropped", invented, "quotes not found in transcript (hallucinated)");
  }

  // Köhnə UI və homework.correction düz siyahı gözləyir — mövzulardan düzəldilir.
  const rawFeedback = errorThemes.length
    ? errorThemes.flatMap((t) => t.items)
    : (Array.isArray(obj.feedback) ? obj.feedback : [])
      .map((f) => ({ original: asStr(f?.original), corrected: asStr(f?.corrected), reason: asStr(f?.reason) }))
      .filter(isRealCorrection)
      .filter((it) => quotedInTranscript(it.original));
  const feedback = rawFeedback.slice(0, 12);

  const scores = obj.scores && typeof obj.scores === "object" ? obj.scores : {};
  const fluency = clampScore(scores.fluency);
  const grammar = clampScore(scores.grammar);
  const vocabScore = clampScore(scores.vocabulary);

  const vocabulary = (Array.isArray(obj.vocabulary) ? obj.vocabulary : [])
    .map((v) => ({ word: asStr(v?.word), example: asStr(v?.example) }))
    .filter((v) => v.word).slice(0, 4);

  // ── Homework normalizasiyası ──────────────────────────────────
  // Söz sırası tapşırığında scrambled HƏMİŞƏ serverdə yenidən qurulur:
  // modelin qarışdırması tez-tez ya söz itirir, ya da düz sıranı "qarışdırır".
  // Deterministik seed → eyni analiz üçün eyni tapşırıq (retry-lar sabit qalır).
  const seededShuffle = (words, seed) => {
    const a = [...words];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    // Qarışdırma təsadüfən düz sıraya düşdüsə, ilk iki sözü çevir.
    if (a.join(" ") === words.join(" ") && a.length > 1) [a[0], a[1]] = [a[1], a[0]];
    return a;
  };
  const sentenceWords = (s) => asStr(s).replace(/[.!?]+$/, "").split(/\s+/).filter(Boolean);

  const hw = obj.homework && typeof obj.homework === "object" ? obj.homework : {};
  const multipleChoice = (Array.isArray(hw.multiple_choice) ? hw.multiple_choice : [])
    .map((q) => ({
      question: asStr(q?.question),
      options: (Array.isArray(q?.options) ? q.options : []).map(asStr).filter(Boolean).slice(0, 3),
      correct_answer: asStr(q?.correct_answer),
      explanation: asStr(q?.explanation),
    }))
    // correct_answer mütləq variantlardan biri olmalıdır — əks halda sual oynanıla bilməz.
    .filter((q) => q.question && q.options.length === 3 && q.options.includes(q.correct_answer))
    .slice(0, 3);

  let wordOrder = (Array.isArray(hw.word_order) ? hw.word_order : [])
    .map((w, i) => {
      const words = sentenceWords(w?.correct_sentence);
      return {
        correct_sentence: asStr(w?.correct_sentence),
        scrambled: seededShuffle(words, 7 + i),
        explanation: asStr(w?.explanation),
      };
    })
    .filter((w) => w.scrambled.length >= 3 && w.scrambled.length <= 12)
    .slice(0, 3);

  // Model word_order verməyibsə, amma real səhvlər varsa — düzəldilmiş
  // cümlələrdən özümüz qururuq: tapşırıqsız "homework" bölməsi boş görünməsin.
  if (wordOrder.length === 0 && feedback.length > 0) {
    wordOrder = feedback
      .map((f, i) => ({ words: sentenceWords(f.corrected), corrected: f.corrected, i }))
      .filter((x) => x.words.length >= 3 && x.words.length <= 10)
      .slice(0, 2)
      .map((x) => ({
        correct_sentence: x.corrected,
        scrambled: seededShuffle(x.words, 13 + x.i),
        explanation: "Bu, sənin öz cümlənin düzəldilmiş formasıdır — sıranı yadda saxla.",
      }));
  }

  return {
    // Hesabat müəllim panelində də birə-bir göstərilir (TeacherStudent →
    // AnalysisDetail) — markdown hər iki oxucu üçün eyni mənbədir.
    reportMarkdown: asStr(obj.report_markdown).slice(0, 4000),
    recap: asStr(obj.recap) || "Söhbətiniz analiz olundu.",
    // Derived, not asked of the model: one less field to hallucinate, and it can
    // never contradict the three scores it is supposed to summarise.
    overallScore: Math.round((fluency + grammar + vocabScore) / 3),
    scores: { fluency, grammar, vocabulary: vocabScore },
    errorThemes,
    feedback,
    strengths: strList(obj.strengths, 2),
    tips: strList(obj.tips, 3),
    vocabulary,
    speakingPace: computeSpeakingPace(transcript, analyzeSeconds),
    homework: {
      multiple_choice: multipleChoice,
      word_order: wordOrder,
      // Spec: homework öz-özlüyündə tam olsun deyə düzəlişlər bura da daxil
      // edilir (feedback ilə eyni obyektlər — token xərci yoxdur, sürüşmə yoxdur).
      correction: feedback,
    },
  };
}

// Groq chat with strict JSON, in-call retries (max 3) and a schema→json_object
// fallback, so json_validate_failed and malformed output self-heal instead of
// failing the ticket permanently.
// Escalating completion budgets: the observed production failure was
// "max completion tokens reached before generating a valid document" — the
// answer was cut mid-JSON, so retrying with the same budget can never succeed.
// A full answer under ANALYSIS_SCHEMA's maxItems (report_markdown + homework
// daxil) is ~1600-2000 tokens, so the first attempt has ample headroom; the
// ladder exists only for the rare overrun. Keyfiyyət qərarı: token xərci
// bilərəkdən artırılıb — analiz məhsulun "WOW" anıdır.
const ANALYSIS_MAX_TOKENS = [6000, 7000, 8000]; // mövzu qrupları + böyüdülmüş tapşırıqlar

// Groq YALNIZ ehtiyat yoldur və günlük token limiti var (TPD). Əsas büdcə ilə
// eyni səxavəti versək, DeepSeek sıradan çıxan gün limit bir neçə analizdən
// sonra tükənir və HEÇ KİM analiz almır. Ehtiyat yol qəsdən daha qənaətcildir:
// hesabat bir az qısa olur, amma işləyir.
const GROQ_FALLBACK_MAX_TOKENS = [3000, 3600, 4200];

// DeepSeek V3 — analizin ƏSAS modeli. Səbəb: Llama-nın Azərbaycan dili real
// istifadədə pozulur ("alıb-san" kimi morfologiya, mənasız izahlar); DeepSeek
// AZ-də qat-qat təbii yazır və pedaqoji izahları dərindir (bax ai-pipeline
// skill: post-call analysis üçün tövsiyə olunan model elə budur). json_schema
// dəstəyi yoxdur → json_object + parseJsonLoose + normalizeAnalysis onsuz da
// hər sahəni yoxlayır. Xəta halında Groq fallback (aşağıda) işə düşür.
const DEEPSEEK_CHAT_TIMEOUT_MS = 90000;

async function callDeepSeekChat(userContent) {
  const res = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY.value()}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: userContent }],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  }, DEEPSEEK_CHAT_TIMEOUT_MS, "DeepSeek chat");

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 300);
    throw Object.assign(new Error("DeepSeek error " + res.status + ": " + errText), {
      retryable: isRetryableStatus(res.status),
    });
  }
  return parseJsonLoose((await res.json()).choices?.[0]?.message?.content);
}

// DeepSeek bəzən Azərbaycan/Türk mətninin ortasına Çin ieroqlifi qoyur
// (istehsalatda görüldü: "否定 cümleleri 'doesn't' şeklinde..."). Prompt-dakı
// qadağa bunu azaldır, amma zəmanət vermir — ona görə çıxış BURADA yoxlanılır.
const CJK_OR_FOREIGN = /[぀-ヿ㐀-䶿一-鿿가-힯؀-ۿЀ-ӿ]/;

function hasForeignScript(value) {
  return CJK_OR_FOREIGN.test(JSON.stringify(value || ""));
}

// Əsas: DeepSeek. O yıxılsa (açar/limit/timeout) — Groq strict-schema yolu.
// Analiz asinxron növbədədir, latency fərqi istifadəçiyə görünmür.
async function callAnalysisLLM(userContent, db) {
  try {
    const first = await callDeepSeekChat(userContent);
    if (!hasForeignScript(first)) return first;

    // Bir dəfə təkrar cəhd — analiz ~$0.005-dir, sınıq hesabat isə istifadəçiyə
    // birbaşa görünür. Təkrar da uğursuz olsa, heç nədənsə bu yaxşıdır.
    console.warn("[Analysis] foreign script in output, retrying once");
    const second = await callDeepSeekChat(
      userContent
      + "\n\nCRITICAL: your previous answer contained characters from another"
      + " writing system (Chinese/Japanese/Korean/Arabic/Cyrillic). Rewrite it"
      + " using ONLY the target language alphabet and plain English words."
    );
    if (hasForeignScript(second)) {
      console.warn("[Analysis] foreign script persisted after retry");
    }
    return second;
  } catch (e) {
    console.warn("[Analysis] DeepSeek failed, falling back to Groq:", e.message);
    // Səssiz keçid ən təhlükəli haldır — admin dərhal xəbər tutmalıdır.
    if (db) await alertProviderIssue(db, "deepseek-down", e.message);
    return callGroqChat(userContent);
  }
}

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
        model: GROQ_CHAT_MODEL,
        // gpt-oss spends part of max_tokens on private reasoning; keep that
        // share small so the JSON answer still fits the budgets below.
        reasoning_effort: "low",
        messages,
        temperature: 0,
        top_p: 1,
        seed: 7,
        max_tokens: GROQ_FALLBACK_MAX_TOKENS[attempt - 1],
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
        messages.push({ role: "system", content: "Cavab çox uzun idi və kəsildi. Qısalt: report_markdown maksimum 100 söz, feedback ən çox 3, multiple_choice ən çox 2, word_order ən çox 2, izahlar 1 cümlə." });
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

// Sadə qayda: 30 dəqiqəyə qədər zəng TAM analiz olunur, daha uzunu isə
// ilk 30 dəqiqə. Faiz məntiqi qəsdən yoxdur — istifadəçi üçün proqnozlaşdırıla
// biləndir ("30 dəqiqəyə qədər hər şey analiz olunur") və tavan bir nəfərin
// saatlıq audio budcəsini tək zənglə yeməsinin qarşısını alır.
// WebM-in bayt-prefiksi dekodlana bilir, ona görə kəsilmiş hissə real və
// bütöv bir parçadır, yamaq deyil.
const ANALYSIS_MAX_SECONDS = 1800; // 30 dəqiqə

function effectiveAnalyzeSeconds(audioSeconds) {
  if (!audioSeconds) return 0;
  return Math.min(audioSeconds, ANALYSIS_MAX_SECONDS);
}

// Data-only push to one user's device (the messaging SW displays it and
// routes clicks via data.url); prunes dead tokens. Data-only avoids the
// SDK double-display problem that notification payloads can cause.
//
// Two calling shapes:
//   { key, vars }          — LOCALISED. Copy comes from pushText.js in the
//                            recipient's own language. Prefer this.
//   { title, body }        — a literal string, for the few pushes that carry no
//                            translatable copy (a chat message body) or that
//                            only ever reach the admin.
//
// The language is read off the user document this function already fetches for
// the legacy fcmToken field, so localisation adds NO Firestore read. `vars.at`
// (an absolute ms timestamp) is turned into a time label in the recipient's own
// language AND timezone here — the caller must not pre-format it, because the
// caller does not know who is reading. (The one push that needs a bare clock
// time rather than a day+time label — the session reminder — is a broadcast
// and formats its own groups with hourOnlyLabel.)
async function sendPushToUser(db, uid, opts) {
  const userSnap = await db.collection("users").doc(uid).get();
  const data = userSnap.exists ? userSnap.data() : {};
  const entries = await getTokensForUser(db, uid, data.fcmToken, data.fcmTokenFailCount);
  if (!entries.length) return;

  let { title, body } = opts;
  if (opts.key) {
    const lang = pushLang(data);
    const vars = { ...(opts.vars || {}) };
    if (typeof vars.at === "number") vars.time = slotTimeLabel(vars.at, lang, data.timeZone);
    ({ title, body } = pushText(lang, opts.key, vars));
  }

  try {
    await sendPush(entries, { title, body, type: opts.type, url: opts.url });
  } catch (error) {
    console.warn("[Push] send failed:", uid, error.message);
  }
}

// Multicast that respects each recipient's language. One sendPush per language
// group instead of one per user: a 500-user broadcast stays 3 FCM calls, not
// 500. `langOf` maps a token entry's uid to its language.
async function sendPushByLang(entries, langOf, key, vars, { type, url }) {
  const groups = new Map();
  for (const e of entries) {
    const lang = langOf(e.uid) || "az";
    if (!groups.has(lang)) groups.set(lang, []);
    groups.get(lang).push(e);
  }
  let sent = 0;
  let removed = 0;
  for (const [lang, group] of groups) {
    const { title, body } = pushText(lang, key, vars);
    try {
      const r = await sendPush(group, { title, body, type, url });
      sent += r.sent || 0;
      removed += r.removed || 0;
    } catch (error) {
      console.warn("[Push] group send failed:", lang, error.message);
    }
  }
  return { sent, removed };
}

// ─── Provayder nasazlığı xəbərdarlığı ────────────────────────────
// 2026-07-26-da DEEPSEEK_API_KEY etibarsız oldu və sistem SƏSSİZCƏ Groq-a
// keçdi: bir qisim istifadəçi zəif dilli hesabat aldı, Groq günlük limiti
// dolandan sonra isə 3 analiz tamamilə itdi. Heç bir siqnal yox idi — problem
// yalnız loglara baxanda göründü. Bu funksiya həmin boşluğu bağlayır.
//
// opsAlerts kolleksiyası catch-all deny ilə clientə tamamilə bağlıdır:
// sistemin hansı provayderdə problem yaşadığı istifadəçiyə göstərilməməlidir.
const PROVIDER_ALERT_THROTTLE_MS = 60 * 60 * 1000; // eyni problem üçün saatda 1

async function alertProviderIssue(db, kind, detail) {
  try {
    const ref = db.collection("opsAlerts").doc("providers");
    const now = Date.now();

    // Nasazlıq hər biletdə təkrarlanır — throttle olmasa yüzlərlə e-poçt gedər.
    const shouldSend = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const prev = data[kind];
      const last = prev && prev.toMillis ? prev.toMillis() : 0;
      if (now - last < PROVIDER_ALERT_THROTTLE_MS) return false;
      tx.set(ref, { [kind]: admin.firestore.Timestamp.fromMillis(now) }, { merge: true });
      return true;
    });
    if (!shouldSend) return;

    const text = String(detail || "").slice(0, 400);
    console.error("[OpsAlert]", kind, text);

    await sendPushToUser(db, ADMIN_UID, {
      title: "⚠️ SpeakLab: AI provayder problemi",
      body: `${kind} — analiz keyfiyyəti düşüb. Detallar e-poçtda.`,
      type: "ops_alert",
      url: "/history",
    }).catch(() => null);

    // E-poçt push-dan etibarlıdır: admin cihazında token olmaya bilər.
    const gmailUser = GMAIL_USER.value();
    const gmailPass = GMAIL_APP_PASSWORD.value();
    if (!gmailUser || !gmailPass) return;

    const to = OPS_ALERT_EMAIL || gmailUser;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: `"SpeakLab Ops" <${gmailUser}>`,
      to,
      subject: `⚠️ SpeakLab: ${kind}`,
      text: `Analiz pipeline-ında problem aşkarlandı.

NÖV: ${kind}
DETAL: ${text}

`
        + `TƏSİRİ: DeepSeek işləmirsə analizlər Groq-a keçir — Azərbaycan/türk dili`
        + ` nəzərəçarpacaq dərəcədə zəifləyir, Groq günlük limiti dolanda isə`
        + ` analizlər tamamilə uğursuz olur.

`
        + `NƏ ETMƏLİ:
`
        + `1. platform.deepseek.com -> balans və API açarını yoxla
`
        + `2. Yeni açar lazımdırsa:
`
        + `   firebase functions:secrets:set DEEPSEEK_API_KEY --project speak2them-64f2b
`
        + `3. Sonra mütləq deploy et:
`
        + `   firebase deploy --only functions:processAnalysisQueue --project speak2them-64f2b

`
        + `Bu xəbərdarlıq eyni problem üçün saatda bir dəfə göndərilir.`,
    });
    console.log("[OpsAlert] email sent to", to);
  } catch (e) {
    // Xəbərdarlıq göndərə bilməmək analizi dayandırmamalıdır.
    console.warn("[OpsAlert] failed:", e.message);
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
    durationSeconds: ticketData.callSeconds || ticketData.audioSeconds || 0,
  }, { merge: true });
  if (ticketData.storagePath) {
    await admin.storage().bucket().file(ticketData.storagePath).delete().catch(() => null);
  }
  console.error("[AnalysisQueue] Failed permanently:", ticketId, text);
  // İstifadəçi analizsiz qaldı — bu, həmişə bilinməlidir.
  await alertProviderIssue(db, "analysis-failed", `${ticketId}: ${text}`);

  // Silence is the worst outcome: without this the user waits for a result that
  // is never coming, because History only ever showed finished analyses.
  const noSpeech = text.startsWith("no-speech");
  await sendPushToUser(db, ticketData.uid, {
    key: "analysis_failed",
    vars: { noSpeech },
    type: "analysis_failed",
    url: "/history",
  });
}

// ─── Transkripsiya: Deepgram nova-2 (əsas) → Groq Whisper (fallback) ──
// nova-2 aksentli, qeyri-native ingiliscədə Whisper-dən nəzərəçarpacaq
// dərəcədə dəqiqdir — analizin bütün keyfiyyəti transkriptdən asılıdır, ona
// görə burada ən yaxşısını işlədirik. smart_format punktuasiya + böyük hərf
// verir ki, LLM cümlə sərhədlərini düzgün görsün (düzəlişlər cümlə əsaslıdır).
const DEEPGRAM_STT_TIMEOUT_MS = 120000;

async function transcribeWithDeepgram(audioBuffer, ext) {
  const mime = ext === "mp4" ? "audio/mp4" : "audio/webm";
  const url = "https://api.deepgram.com/v1/listen"
    + "?model=nova-2&language=en&smart_format=true&punctuate=true&filler_words=false";

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Authorization": `Token ${DEEPGRAM_API_KEY.value()}`,
      "Content-Type": mime,
    },
    body: audioBuffer,
  }, DEEPGRAM_STT_TIMEOUT_MS, "Deepgram STT");

  if (!res.ok) {
    const err = new Error("Deepgram error " + res.status + ": " + (await res.text().catch(() => "")).slice(0, 300));
    err.retryable = isRetryableStatus(res.status);
    throw err;
  }
  const json = await res.json();
  return json?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

async function transcribeWithGroqWhisper(audioBuffer, ext) {
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
  return (await whisperRes.json()).text || "";
}

// `lang` = istifadəçinin ana dili ('az' | 'tr') — hesabat həmin dildə yazılır.
async function runGroqAnalysis(audioBuffer, analyzeSeconds, ext = "webm", lang = "az", db = null) {
  let transcript = "";
  try {
    transcript = await transcribeWithDeepgram(audioBuffer, ext);
  } catch (e) {
    // Deepgram açarı/limiti/timeout — analiz tamamilə itməsin deyə Whisper-ə keç.
    console.warn("[Analysis] Deepgram failed, falling back to Whisper:", e.message);
    if (db) await alertProviderIssue(db, "deepgram-down", e.message);
    transcript = await transcribeWithGroqWhisper(audioBuffer, ext);
  }

  if (!transcript || !transcript.trim()) {
    const err = new Error("no-speech: could not hear any speech in the audio");
    err.retryable = false;
    throw err;
  }

  // 2. Analysis via DeepSeek (Groq fallback) — strict JSON, self-healing retries.
  const promptTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : transcript;
  const raw = await callAnalysisLLM(buildAnalysisPrompt(promptTranscript, lang), db);
  const analysis = normalizeAnalysis(raw, { analyzeSeconds, transcript });
  return { transcript, analysis };
}

exports.processAnalysisQueue = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Baku",
  // DEEPGRAM: nova-2 STT (əsas); DEEPSEEK: analiz LLM-i (əsas);
  // GROQ: Whisper STT + LLM fallback-ları.
  secrets: [GROQ_API_KEY, DEEPSEEK_API_KEY, DEEPGRAM_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD],
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
      // Hesabat istifadəçinin ana dilində yazılır. Dil ticket-də deyil, user
      // sənədində saxlanılır (analysisQueue rules sahə siyahısı ilə bağlıdır və
      // client-in göndərdiyi dilə güvənmək də lazım deyil) — bir oxu bahasına.
      let lang = "az";
      let studentTeacherId = null;
      let studentName = "";
      try {
        const uSnap = await db.collection("users").doc(ticket.uid).get();
        const u = uSnap.exists ? uSnap.data() : {};
        const pref = u.preferredLanguage;
        if (pref === "tr" || pref === "az") lang = pref;
        // Eyni oxudan müəllim bildirişi üçün lazım olanları da götürürük.
        studentTeacherId = u.teacherId || null;
        studentName = u.name || "";
      } catch (e) {
        console.warn("[AnalysisQueue] lang lookup failed, defaulting to az:", e.message);
      }

      const { transcript, analysis } = await runGroqAnalysis(analysisBuffer, analyzeSeconds, ext, lang, db);

      await analysisRef.set({
        ...analysis,
        transcript,
        status: "done",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: ticket.uid,
        peerName: ticket.peerName || null,
        // İstifadəçiyə göstərilən müddət zəngin özününküdür. audioSeconds
        // sükut kəsildikdən sonrakı FAYL uzunluğudur — onu göstərsək 30
        // dəqiqəlik zəng History-də 12 dəqiqə kimi görünərdi. Köhnə
        // ticket-lərdə callSeconds yoxdur, onlar üçün geriyə uyğunluq.
        durationSeconds: ticket.callSeconds || ticket.audioSeconds || 0,
        analyzedSeconds: analyzeSeconds,
      }, { merge: true });
      await ticket.ref.update({
        status: "done",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await admin.storage().bucket().file(ticket.storagePath).delete().catch(() => null);
      console.log("[AnalysisQueue] Done:", ticket.id);

      await sendPushToUser(db, ticket.uid, {
        key: "analysis_ready",
        type: "analysis_ready",
        url: "/history",
      });

      // Sinif analitikası üçün roster rollup-u. Müəllim paneli 30 şagirdin
      // analizlərini bir-bir sorğulasaydı, callAnalysis rules-undakı
      // get(users/{userId}) səbəbindən yüzlərlə əlavə oxu olardı. Əvəzinə
      // nəticə elə burada — analizin bitdiyi yerdə — roster sətrinə yazılır;
      // panel onsuz da yüklədiyi roster ilə bütün sinfi ƏLAVƏ OXUSUZ hesablayır.
      if (studentTeacherId) {
        try {
          const rosterRef = db.collection("teachers").doc(studentTeacherId)
            .collection("roster").doc(ticket.uid);
          const themes = Array.isArray(analysis.errorThemes)
            ? analysis.errorThemes
              .map((t) => String((t && t.title) || "").trim())
              .filter(Boolean)
            : [];
          const score = Number(analysis.overallScore);

          await db.runTransaction(async (tx) => {
            const snap = await tx.get(rosterRef);
            const prev = snap.exists ? (snap.data() || {}) : {};
            const prevThemes = Array.isArray(prev.recentThemes) ? prev.recentThemes : [];
            tx.set(rosterRef, {
              displayName: studentName || prev.displayName || "",
              lastAnalysisAt: admin.firestore.FieldValue.serverTimestamp(),
              recentThemes: [...themes, ...prevThemes].slice(0, ROSTER_THEME_MEMORY),
              // scoreSum/scoreCount ayrı saxlanılır ki, panel ortalamanı
              // bölmə ilə çıxarsın — keçmiş analizləri yenidən oxumadan.
              ...(Number.isFinite(score) ? {
                lastScore: score,
                scoreSum: (Number(prev.scoreSum) || 0) + score,
                scoreCount: (Number(prev.scoreCount) || 0) + 1,
              } : {}),
            }, { merge: true });
          });
        } catch (e) {
          console.warn("[AnalysisQueue] roster rollup failed:", e.message);
        }
      }

      // Müəllimə gedən YEGANƏ push: bağlı şagirdin analizi hazırdır.
      // Müəllim mövzu/streak/sessiya xatırlatmalarından azaddır (bax
      // topicReminder), ona görə bu bildiriş itmir və spam kimi görünmür.
      if (studentTeacherId) {
        try {
          // The teacher's own document used to be re-read here just to pick a
          // language; sendPushToUser reads it anyway, so that read is gone.
          await sendPushToUser(db, studentTeacherId, {
            key: "student_analysis_ready",
            vars: { studentName },
            type: "student_analysis_ready",
            url: `/teacher/student/${ticket.uid}`,
          });
        } catch (e) {
          console.warn("[AnalysisQueue] teacher push failed:", e.message);
        }
      }
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
    // Müəllimlər şagird xatırlatmalarından azaddır — push tərəfində bu filtr
    // artıq var (topicReminder, streakReminder, broadcastSessionReminder), amma
    // e-poçt dövründə yox idi: müəllim "sessiyaya 15 dəqiqə qaldı" məktubu
    // alırdı. Peşəkar görünmür, üstəlik bildirişi dəyərsizləşdirir.
    if (u.role === "teacher") continue;
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
async function broadcastSessionReminder(db, startLabel, startMs) {
  const usersSnap = await db.collection("users").get();
  // Müəllimlər sessiya xatırlatması almır (bax topicReminder şərhi).
  const users = usersSnap.docs
    .filter((d) => d.data().role !== "teacher")
    .map((d) => ({ ref: d.ref, fcmToken: d.data().fcmToken, fcmTokenFailCount: d.data().fcmTokenFailCount }));
  const tokenEntries = await getAllTokens(db, users);

  // Grouped by language AND timezone: a Baku 21:00 session is 20:00 in
  // Istanbul, and the reminder has to say the hour the reader's own clock will
  // show. Falls back to the Baku label when the device never reported a zone.
  const metaByUid = new Map(usersSnap.docs.map((d) => {
    const u = d.data();
    return [d.id, { lang: pushLang(u), tz: u.timeZone || null }];
  }));
  const keyOf = (uid) => {
    const m = metaByUid.get(uid) || {};
    return `${m.lang || "az"}|${m.tz || ""}`;
  };

  const groups = new Map();
  for (const e of tokenEntries) {
    const k = keyOf(e.uid);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }

  let sent = 0;
  let removed = 0;
  for (const [k, group] of groups) {
    const [lang, tz] = k.split("|");
    const time = Number.isFinite(startMs) && tz ? hourOnlyLabel(startMs, tz) : startLabel;
    const copy = pushText(lang, "session_reminder", { time });
    try {
      const r = await sendPush(group, { ...copy, type: "session_reminder", url: "/" });
      sent += r.sent || 0;
      removed += r.removed || 0;
    } catch (e) {
      console.warn("[SessionMatch] group send failed:", k, e.message);
    }
  }
  console.log("[SessionMatch] reminder sent:", sent, "invalidTokensRemoved:", removed);
}

// Same normalisation as the client (src/utils/sessionSchedule.js): a non-empty
// `sessions` array wins, else the standard evening session. Legacy single
// hour/minute configs are intentionally upgraded to the default.
//
// Praktika YALNIZ axşam 21:00-dır — günorta (16:00) sessiyası ləğv edildi.
// matchSessionQueue bu siyahı üzərində dövr etdiyi üçün siyahıdan çıxan saat
// avtomatik olaraq nə xatırlatma push-u/e-poçtu göndərir, nə də cütləşdirir.
const DEFAULT_SESSION_TIMES = [{ hour: 21, minute: 0 }];
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
        await broadcastSessionReminder(db, startLabel, startMs);
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

// ─── "Someone is looking for a partner" push — SÖNDÜRÜLÜB ─────────
// Bu bildiriş strukturca işləyə bilmirdi: alıcı siyahısı `lastSeen` son 5
// dəqiqə ilə məhdud idi, yəni YALNIZ onsuz da tətbiqdə olanlara gedirdi. Sənə
// lazım olan adam — oflayn olan — heç vaxt xəbər tutmurdu. Üstəlik bütün tətbiq
// üçün 10 dəqiqəlik ümumi cooldown vardı, deməli ikinci axtarış susdurulurdu.
//
// Yerini praktika slotları tutdu: axtarış tapmadıqda istifadəçi cari blokun
// üzvü olur, sonrakı adam bloka qoşulanda push YALNIZ həmin bir nəfərə gedir
// (joinPracticeSlot). Hədəflənmiş, spam deyil, oflayn adamı da tutur.
//
// Funksiya silinmək əvəzinə erkən return edir: silmək deploy-da `--force`
// tələb edir və trigger-in birdən yox olması təhlükəlidir.
const SEARCH_PING_COOLDOWN_MS = 10 * 60 * 1000;
const SEARCH_PING_MAX_RECIPIENTS = 30;
const PRESENCE_FRESH_MS = 5 * 60 * 1000;
const SEARCH_PING_ENABLED = false;

exports.notifySearchingUser = onDocumentWritten("matchQueue/{uid}", async (event) => {
  if (!SEARCH_PING_ENABLED) return;
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
  const langByUid = new Map();
  for (const docSnap of onlineSnap.docs) {
    if (docSnap.id === searcherUid) continue;
    const data = docSnap.data();
    if (data.status === "busy") continue; // already in a call
    langByUid.set(docSnap.id, pushLang(data));
    const entries = await getTokensForUser(db, docSnap.id, data.fcmToken, data.fcmTokenFailCount);
    for (const e of entries) {
      recipients.push(e);
      if (recipients.length >= SEARCH_PING_MAX_RECIPIENTS) break;
    }
    if (recipients.length >= SEARCH_PING_MAX_RECIPIENTS) break;
  }

  const searcherName = String(after.name || "").slice(0, 30);
  const { sent } = await sendPushByLang(
    recipients,
    (uid) => langByUid.get(uid),
    "search_ping",
    { searcherName },
    { type: "search_ping", url: "/" },
  );
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
    // 0) Müəllim/şagird bağlantısını silməzdən ƏVVƏL oxu — user sənədi
    //    silindikdən sonra bu məlumat itir.
    let userData = {};
    try {
      const uSnap = await db.collection("users").doc(uid).get();
      if (uSnap.exists) userData = uSnap.data() || {};
    } catch (e) {
      console.warn("[deleteAccount] user read failed:", e.message);
    }

    // 1) Owned documents (+ their sub-collections).
    //    'blocked' və 'private' (yaş təsdiqi) də silinməlidir — əks halda
    //    silinmiş hesabın şəxsi qeydləri Firestore-da qalır.
    await deleteDocDeep(db.collection("users").doc(uid), ["fcmTokens", "blocked", "private"]);
    await deleteDocDeep(db.collection("wordHistory").doc(uid), ["words"]);
    await db.collection("matchQueue").doc(uid).delete().catch(() => null);
    await db.collection("premiumRequests").doc(uid).delete().catch(() => null);

    // 1b) Müəllim funnel-i məlumatları.
    try {
      // Şagird idisə — müəllimin siyahısından çıxar, sayğacı azalt. Bunsuz
      // silinmiş şagird müəllimin panelində "kabus sətir" kimi qalırdı.
      if (userData.teacherId) {
        await db.collection("teachers").doc(userData.teacherId)
          .collection("roster").doc(uid).delete().catch(() => null);
        await db.collection("teachers").doc(userData.teacherId).update({
          studentCount: admin.firestore.FieldValue.increment(-1),
        }).catch(() => null);
        // Publik profildəki güzgü sayğac da azalmalıdır, yoxsa tutor profili
        // olmayan şagirdi saymağa davam edər.
        await db.collection("users").doc(userData.teacherId).set({
          tutorStudentCount: admin.firestore.FieldValue.increment(-1),
        }, { merge: true }).catch(() => null);
      }
      // Müəllim idisə — profili, şagird siyahısı və dəvət kodları silinir.
      if (userData.role === "teacher") {
        await deleteDocDeep(db.collection("teachers").doc(uid), ["roster"]);
        await deleteByQuery(db.collection("inviteCodes").where("teacherId", "==", uid));
      }
    } catch (e) {
      console.warn("[deleteAccount] teacher-link cleanup failed:", e.message);
    }

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

// ─── AInur activities (SpeakLab 2.0) ───────────────────────────
// A guided practice session with AInur: she sets a task, the learner speaks,
// she reacts, and at the end the whole thing is analysed with the SAME pipeline
// that analyses a human call. Two rules shape everything below.
//
// 1. The conversational model NEVER grades. Correction is a separate call at
//    the end of the session (analyzeAiSession). That is the delayed-correction
//    principle from SPEAKLAB_TEACHER_HANDOFF.md: never interrupt a learner
//    mid-sentence to fix a verb. It also puts each job on the model that suits
//    it — fast and warm for talking, structured and strict for grading.
// 2. Turns are written SERVER-side. If the client could edit the transcript,
//    the report — and what reaches the teacher — could be faked.

const AI_TURN_MAX_PER_HOUR = 120;   // ~12 sessions/hour; a real session is ~10 turns

// How much English AInur is allowed to use back. An 8B model drifts up to B2
// prose for an A1 learner within a few turns, which is exactly the failure the
// brief called out (it must match the learner level), so the constraint is
// spelled out in words rather than left to the model to judge.
const LEVEL_GUIDE = {
  A1: { words: "4-8", grammar: "present simple only", vocab: "the 1000 most common English words", extra: "One idea per sentence. Never use a phrasal verb." },
  A2: { words: "6-10", grammar: "present simple, past simple, going to", vocab: "the 2000 most common English words", extra: "At most one clause per sentence." },
  B1: { words: "8-14", grammar: "common tenses, simple conditionals", vocab: "the 3000 most common English words", extra: "You may use very common phrasal verbs." },
  B2: { words: "10-18", grammar: "any common tense, passive, relative clauses", vocab: "everyday and semi-formal vocabulary", extra: "Natural rhythm; an occasional idiom is fine." },
  C1: { words: "12-22", grammar: "unrestricted", vocab: "unrestricted", extra: "Speak as you would to a fluent friend." },
};
const levelGuide = (lvl) => LEVEL_GUIDE[String(lvl || "B1").toUpperCase().slice(0, 2)] || LEVEL_GUIDE.B1;

// Mistakes Azerbaijani and Turkish speakers make BECAUSE of their first
// language. A generic tutor cannot do this; it is the one thing a global app
// will not have. Same source as LANGUAGE_GUIDE above, phrased for conversation.
const L1_WATCHLIST = {
  az: [
    'he/she mix-ups — Azerbaijani has one pronoun ("o") for both, so "my sister... he works" is very common',
    "missing a/an/the — Azerbaijani has no articles",
    "past simple used where present perfect is needed, and the reverse",
    "word order — Azerbaijani puts the verb last",
    "idioms translated word for word from Azerbaijani",
  ],
  tr: [
    'he/she mix-ups — Turkish has one pronoun ("o") for both',
    "missing a/an/the — Turkish has no articles",
    "past simple used where present perfect is needed, and the reverse",
    "word order — Turkish puts the verb last",
    "idioms translated word for word from Turkish",
  ],
};

// The five layers. Persona and pedagogy are fixed; learner, activity and state
// change every turn. Keeping them separate is what makes a second activity a
// data change rather than a new prompt.
function buildAinurPrompt({ activity, level, l1 = "az", item = {}, state = {} }) {
  const g = levelGuide(level);
  const watch = (L1_WATCHLIST[l1] || L1_WATCHLIST.az).map((w) => "- " + w).join("\n");

  const persona = `You are AInur, an English speaking partner in the SpeakLab app.
You are warm, curious and brief. You are a person having a conversation, not a chatbot presenting options.
Never mention that you are an AI, never break character, never use markdown, emoji, bullet points or stage directions. Your words are read aloud, so write only what should be spoken.`;

  const pedagogy = `HOW YOU TEACH
- The learner should be talking about 80% of the time. You are the smaller voice.
- NEVER correct grammar or vocabulary during the conversation. Not once. Mistakes are collected and explained after the session by someone else. If a sentence is broken but you understood it, respond to the meaning.
- Never repeat the sentence back in corrected form. That is a correction.
- Ask exactly ONE question per turn. Never two.
- End every turn with that question, so the learner always speaks last.
- If the learner says very little, ask them to say more about one specific thing they mentioned, and name it.
- If you did not understand, say so plainly and ask them to say it another way.`;

  const learner = `THE LEARNER
Their English level is ${level}. Their first language is ${l1 === "tr" ? "Turkish" : "Azerbaijani"}.
Speak so they understand you easily:
- Sentences of about ${g.words} words.
- Grammar: ${g.grammar}.
- Vocabulary: ${g.vocab}.
- ${g.extra}
These are mistakes their first language causes. Do NOT correct them, but understand what they meant:
${watch}`;

  const turnState = activity === "describe"
    ? (state.isLast
      // The answer to her question used to get NO reply at all: the server
      // returned reply:"" and the picture simply changed. Answering a question
      // and receiving silence is indistinguishable from the app being broken,
      // which is exactly how it was reported. She now closes the picture.
      ? `THIS TURN
They have just ANSWERED the question you asked about this picture, and the picture is finished.
Say ONE short warm sentence that shows you took in what they just told you, and stop.
Do NOT ask a question — the picture changes the moment you finish, so they could never answer it.
Do NOT go back to describing the picture. Respond to their answer, not to the photograph.
NEVER repeat a sentence you have already said, and never send the same sentence twice in one reply. If their answer does not really answer your question -- speech gets cut off, and people wander -- respond to whatever they DID say. Saying your own last line back to them is the one thing you must never do.`
      : `THIS TURN
This is your first and only QUESTION about this picture. React in a clause, ask your question, stop. They get one answer, and you will close the picture after it.`)
    : `THIS TURN
Turn ${(state.turnIndex || 0) + 1} of about ${state.plannedTurns || 2} on this item.
${state.isLast
  ? "This is the LAST exchange on this item and we move on the moment you finish speaking. Do NOT ask a question — there is no chance for them to answer it. Say one short warm sentence about what they told you, and stop."
  : "There is at least one more exchange to come, so end with your question as usual."}`;

  let contract;
  if (activity === "describe") {
    const kw = Array.isArray(item.keywords) && item.keywords.length ? item.keywords.join(", ") : "(none given)";
    contract = `THE ACTIVITY: describing a picture
The learner is looking at a photograph. YOU CANNOT SEE IT.
The only thing you know is that these things are probably in it: ${kw}.
Because you cannot see the picture:
- Never describe the picture yourself.
- Never state a detail the learner has not stated.
- Never say whether their description is right or wrong. You have no way to know.
This is about THIS picture only. Never mention an earlier picture — you cannot see any of them and the learner has moved on.

${state.isLast
  ? `YOUR WHOLE REPLY IS ONE SENTENCE AND NOTHING ELSE
One short COMPLETE SENTENCE that picks up something concrete in the answer they just gave, in your own words. No question, no second sentence, no sign-off.`
  : `YOUR WHOLE REPLY IS TWO PARTS AND NOTHING ELSE
1. One short COMPLETE SENTENCE naming ONE concrete thing they actually said, in your own words.
2. One question.
Write both on a single line, as ordinary prose. Never a line break, never a heading.`}

YOUR FIRST SENTENCE MUST CONTAIN A FINITE VERB. This is the rule you break most often, so check it before you send.
Begin it with a subject -- The, A, She, He, They, It, There, or a name -- and then put the verb straight after it.
  GOOD: "The teacher is standing at the whiteboard."
  GOOD: "There is a red basket full of vegetables."
  BAD:  "Girl using a laptop for an online lesson."   <- no finite verb
  BAD:  "A classroom with a big whiteboard."          <- no verb at all
  BAD:  "Woman with a red basket."                    <- no verb at all
A noun with some words hanging off it is not a sentence. The learner is learning English from the way you write, and copying a fragment teaches them to write fragments, so every sentence you send must be one they could safely copy.
Do not open with "You mentioned" or "You said" — name the thing directly, the way someone listening would. Five pictures of "You mentioned X" in a row sounds like a form being filled in.

THE QUESTION IS THE POINT, AND IT MUST ASK FOR SOMETHING THEY HAVE NOT ALREADY TOLD YOU.
Before you write it, apply this test: could the question be answered by a sentence they have already spoken? If yes, it is the wrong question. Throw it away and ask a different one. Asking someone to repeat what they just said is the one thing that makes you sound like you were not listening.
- They said the woman is wearing a red coat → do NOT ask what colour her coat is. Ask why she might be dressed like that.
- They said two people are sitting at a table → do NOT ask how many people there are, or where they are. Ask what you think they are talking about.
- They said it looks like a market → do NOT ask where it is. Ask what they would buy there.
The best questions ask for what a photograph cannot show: a reason, a feeling, what happened just before, what happens next, or what the learner themselves would do there.
Never ask about a detail they did not mention as if they had mentioned it.
Exactly one question. Never two, and never one question containing "or" that offers two things to answer.
Keep the whole reply under 25 words.`;
  } else {
    contract = `THE ACTIVITY: open conversation
Keep a natural conversation going about: ${item.topic || "everyday life"}.`;
  }

  return [persona, pedagogy, learner, contract, turnState].join("\n\n");
}

// Did the learner actually SAY the target words? A plain match on the
// transcript — no model involved, so the pills on screen light up instantly and
// cost nothing. Case and punctuation are folded, and a trailing s or es counts,
// so "Suitcases." matches "suitcase".
// Two ways an AInur reply comes back broken, both seen in real sessions:
// the same sentence emitted twice with no space between ("X.X."), and the model
// repeating its OWN previous line instead of responding to the learner. The
// second happens when the answer does not address the question -- which is
// routine, because speech gets clipped -- and it is the worst possible output
// here: the learner says something, and she replies with the sentence she just
// said. That reads exactly like the bug this activity was reported for, so it
// is repaired deterministically instead of being left to the prompt.
function sanitizeAinurReply(reply, history, fallback) {
  let out = String(reply || "").trim();
  // "desk.The teacher" -- restore the space before splitting, or the whole
  // thing counts as one sentence and the duplicate survives.
  out = out.replace(/([.!?])(?=[A-Z])/g, "$1 ");
  const seen = new Set();
  out = out
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => {
      if (!x) return false;
      const k = x.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" ");
  // Compared SENTENCE BY SENTENCE, not whole-string. The observed failure was
  // "X.X." where X was merely the first half of her previous reply, so after
  // de-duplication it still came out as a line she had already said -- a whole
  // -string check waves that through.
  const lastAinur = [...(history || [])].reverse().find((h) => h && h.role === "assistant");
  if (lastAinur && out) {
    const said = new Set(
      String(lastAinur.content || "")
        .replace(/([.!?])(?=[A-Z])/g, "$1 ")
        .split(/(?<=[.!?])\s+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    );
    const fresh = out.split(/(?<=[.!?])\s+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (fresh.length && fresh.every((x) => said.has(x))) return fallback;
  }
  return out || fallback;
}

function matchKeywords(transcript, keywords) {
  if (!Array.isArray(keywords) || !keywords.length) return [];
  const flat = " " + String(transcript).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ") + " ";
  const hit = [];
  for (const raw of keywords) {
    const label = raw && raw.word ? raw.word : raw;
    const w = String(label).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    if (!w) continue;
    if (flat.includes(" " + w + " ") || flat.includes(" " + w + "s ") || flat.includes(" " + w + "es ")) hit.push(label);
  }
  return hit;
}


// Which Groq chat model to use for an AInur turn.
//
// Models get decommissioned without notice, so the list is walked in order and
// the first working one is remembered for the life of the instance. Without
// that the whole activity is dead the day Groq retires a name.
//
// This once read "70B first, because a smaller model cannot hold a CEFR level
// across a session". That was a reasonable preference and a dead letter: 70B
// has never been reachable on this account, so every turn ever served came
// from gpt-oss-20b anyway, by way of two failed requests.
// Ordered by what this Groq account can ACTUALLY reach, newest probe first.
// Probed 2026-08-22 against the live key: llama-3.3-70b-versatile 404,
// llama-4-scout 404, llama-3.1-8b-instant 404, openai/gpt-oss-20b 200. With the
// dead names in front, every cold instance burned two failed round trips before
// its first real answer -- pure latency on the turn a learner is most likely to
// judge the activity by. The unreachable names are kept BELOW the working one
// rather than deleted: if the account regains them the fallback still finds
// them, and the day gpt-oss is retired this list is what keeps the activity
// alive. Re-probe before assuming any of the 404s is still a 404.
const AI_TURN_MODELS = [
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.1-8b-instant",
];
let aiTurnModel = null;

// gpt-oss models spend tokens on private reasoning BEFORE the answer, and both
// come out of the same budget. At max_tokens 90 the reasoning ate all of it and
// AInur was cut off mid-question. Give those models room and ask them to think
// briefly; every other model keeps the tight cap that keeps replies short.
function modelParams(model, body) {
  if (model.includes("gpt-oss")) {
    return { ...body, model, max_tokens: 600, reasoning_effort: "low" };
  }
  return { ...body, model };
}

async function groqChatWithFallback(body, apiKey) {
  const order = aiTurnModel ? [aiTurnModel, ...AI_TURN_MODELS.filter((m) => m !== aiTurnModel)] : AI_TURN_MODELS;
  let lastErr = "";
  for (const model of order) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(modelParams(model, body)),
    });
    if (res.ok) {
      if (aiTurnModel !== model) {
        aiTurnModel = model;
        console.log("[aiActivityTurn] using model:", model);
      }
      return res;
    }
    lastErr = await res.text();
    // Only a missing/forbidden model is worth retrying elsewhere. A rate limit
    // or a bad request would fail the same way on every model.
    if (!/model_not_found|does not exist|do not have access|model_decommissioned/i.test(lastErr)) {
      console.error("[aiActivityTurn] LLM failed on", model + ":", lastErr);
      return null;
    }
    console.warn("[aiActivityTurn] model unavailable, trying next:", model);
  }
  console.error("[aiActivityTurn] no usable Groq model. Last error:", lastErr);
  return null;
}

// Per-user, per-day cost meter. Nothing here blocks a request — the decision
// about limits is deliberately deferred until there is real data behind it.
// Written server-side only; the collection has no rules match, so the catch-all
// denies clients (same pattern as analysisBudget).
async function recordAiUsage(uid, { sttSeconds = 0, ttsChars = 0, tokensIn = 0, tokensOut = 0, turns = 0, sessions = 0 }) {
  try {
    const inc = admin.firestore.FieldValue.increment;
    await admin.firestore().collection("aiUsage").doc(`${uid}_${bakuDateStr()}`).set({
      uid,
      date: bakuDateStr(),
      sttSeconds: inc(Math.round(sttSeconds)),
      ttsChars: inc(ttsChars),
      llmTokensIn: inc(tokensIn),
      llmTokensOut: inc(tokensOut),
      turns: inc(turns),
      sessions: inc(sessions),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    // Metering must never break a lesson.
    console.warn("[aiUsage] write failed:", e.message);
  }
}

exports.aiActivityTurn = onRequest(
  { secrets: [GROQ_API_KEY, DEEPGRAM_API_KEY], memory: "1GiB", invoker: "public" },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");

    let decoded;
    try {
      decoded = await verifyAuth(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const uid = decoded.uid;

    try {
      await enforceRateLimit(uid, "aiTurn", AI_TURN_MAX_PER_HOUR, 60 * 60 * 1000);
    } catch {
      return res.status(429).json({ error: "You have practised a lot in the last hour. Try again shortly." });
    }

    const {
      sessionId,
      activity = "describe",
      topicIndex = 0,
      itemId = "",
      itemIndex = 0,
      keywords = [],
      turnIndex = 0,
      plannedTurns = 2,
      isLast = false,
      history = [],
      base64Audio,
      mimeType = "audio/webm",
      level = "B1",
    } = req.body || {};

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 64) {
      return res.status(400).json({ error: "sessionId required" });
    }
    if (!base64Audio || typeof base64Audio !== "string") {
      return res.status(400).json({ error: "base64Audio required" });
    }
    // ~6 MB. Unbounded, one request could exhaust the instance and be billed
    // for transcribing whatever was sent.
    if (base64Audio.length > 8000000) {
      return res.status(413).json({ error: "Audio too large" });
    }
    if (!Array.isArray(keywords) || keywords.length > 24) {
      return res.status(400).json({ error: "keywords must be an array of at most 24" });
    }
    // The exchange so far on THIS item. Without it every turn was a cold
    // call: AInur saw only the latest sentence, not her own question or the
    // answer before it, so her follow-ups did not follow from anything. The
    // client resets it when the picture changes, which is also what keeps a
    // previous picture from leaking into the next one.
    if (!Array.isArray(history) || history.length > 8) {
      return res.status(400).json({ error: "history must be an array of at most 8 turns" });
    }

    const db = admin.firestore();
    const sessionRef = db.collection("aiSessions").doc(`${uid}_${sessionId}`);

    try {
      const audioBuffer = Buffer.from(base64Audio, "base64");
      if (audioBuffer.length < 100) {
        return res.status(400).json({ error: "That recording was too short." });
      }

      // 1. Speech to text
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
      form.append("model", "whisper-large-v3-turbo");
      form.append("response_format", "json");

      const sttRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY.value()}` },
        body: form,
      });
      if (!sttRes.ok) {
        console.error("[aiActivityTurn] STT failed:", await sttRes.text());
        return res.status(502).json({ error: "We could not hear that. Please try again." });
      }
      const transcript = ((await sttRes.json()).text || "").trim();
      if (!transcript) {
        // Silence is not an error the learner caused. Say so plainly and let
        // them retry without burning an LLM or TTS call.
        return res.status(200).json({ transcript: "", reply: "", audioBase64: "", matchedKeywords: [], silent: true });
      }

      const matchedKeywords = matchKeywords(transcript, keywords);

      // Writing the turn away. Server-side only -- see the note at the top of
      // this block -- and hoisted into a function because the closing answer
      // below returns before the model is ever called.
      const saveTurn = async (replyText) => {
        const now = Date.now();
        await sessionRef.set({
          uid,
          activity,
          topicIndex,
          level,
          status: "active",
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        const spoken = [
          { role: "student", text: transcript, itemId, itemIndex, ms: now, sec: Math.round(audioBuffer.length / 16000) },
        ];
        // A closing answer has no reply to store, and arrayUnion() throws when
        // handed nothing, so the student turn always leads.
        if (replyText) spoken.push({ role: "ainur", text: replyText, itemId, itemIndex, ms: now + 1 });
        const turnUpdate = {
          turns: admin.firestore.FieldValue.arrayUnion(...spoken),
          turnCount: admin.firestore.FieldValue.increment(1),
        };
        // Most early turns match no keywords at all, so only add the field when
        // there is something in it.
        if (matchedKeywords.length) {
          turnUpdate.keywordsHit = admin.firestore.FieldValue.arrayUnion(...matchedKeywords);
        }
        await sessionRef.update(turnUpdate);
      };

      // The closing answer on a picture USED TO RETURN reply:"" and skip the
      // model entirely, to save one LLM call per picture. That saving is what
      // broke the activity: the learner answered her question and got nothing
      // back at all -- the bubble still showed the question they had just
      // answered, then the photo swapped. Reported, correctly, as "I did, but
      // nothing happened". She answers every answer now. It costs one LLM call
      // per picture and no TTS (describing stays silent), which is the cheap
      // half of the turn; the expensive half is the transcription we were
      // paying for anyway.
      // 2. AInur replies. Which model that actually is comes from
      // AI_TURN_MODELS -- see the note there; the 70B this comment used to name
      // is not reachable on this account.
      const systemPrompt = buildAinurPrompt({
        activity,
        level,
        l1: "az",
        item: { keywords },
        state: { turnIndex, plannedTurns, isLast },
      });

      const safeHistory = history
        .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
        .slice(-8)
        .map((h) => ({ role: h.role, content: h.content.slice(0, 1200) }));

      const chatRes = await groqChatWithFallback({
        messages: [
          { role: "system", content: systemPrompt },
          ...safeHistory,
          { role: "user", content: transcript },
        ],
        temperature: 0.6,
        max_tokens: 90,
      }, GROQ_API_KEY.value());
      if (!chatRes) {
        return res.status(502).json({ error: "AInur could not answer just now. Please try again." });
      }
      const chatData = await chatRes.json();
      const isDescribeClose = activity === "describe" && isLast;
      const reply = sanitizeAinurReply(
        chatData.choices?.[0]?.message?.content,
        safeHistory,
        // A closing line cannot ask for more -- the picture is already going.
        isDescribeClose ? "Thank you, that is a good way to put it." : "Tell me a little more about that.",
      );
      const usage = chatData.usage || {};

      // 3. Text to speech.
      //
      // Describing pictures is a SILENT activity now, apart from one spoken
      // line at the very start of the session (src/utils/ainurVoice.js, cached
      // on the device, so it costs one call ever). Her follow-up question is
      // read, not heard. That drops the dominant cost of the activity -- TTS
      // was more than half of it -- and, more importantly, it removes the wait
      // between the learner finishing and being allowed to speak again.
      //
      // Decided here rather than taken from the request: a client that asked
      // for a voice on every describe turn would simply be billing us for it.
      let audioBase64 = "";
      if (activity !== "describe") {
        try {
          const ttsRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Token ${DEEPGRAM_API_KEY.value()}`,
            },
            body: JSON.stringify({ text: reply }),
          });
          if (ttsRes.ok) {
            audioBase64 = Buffer.from(await ttsRes.arrayBuffer()).toString("base64");
          } else {
            console.warn("[aiActivityTurn] TTS failed:", await ttsRes.text());
          }
        } catch (e) {
          // A missing voice is a degraded lesson, not a failed one — the reply
          // is on screen either way.
          console.warn("[aiActivityTurn] TTS error:", e.message);
        }
      }

      // 4. Persist the turn
      await saveTurn(reply);

      // Rough audio seconds from the encoded size — webm/opus at the browser
      // default sits near 16 kB/s. Only feeds the cost meter.
      recordAiUsage(uid, {
        sttSeconds: audioBuffer.length / 16000,
        ttsChars: reply.length,
        tokensIn: usage.prompt_tokens || 0,
        tokensOut: usage.completion_tokens || 0,
        turns: 1,
      });

      // closing tells the client this picture is done, so it can show her line
      // and then move on. It is derived here rather than trusted from the
      // request, exactly like the TTS decision above.
      return res.status(200).json({
        transcript, reply, audioBase64, matchedKeywords,
        closing: isDescribeClose,
      });
    } catch (e) {
      console.error("[aiActivityTurn] error:", e);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  },
);

// End of session: grade it. Runs the EXISTING analysis pipeline, so the result
// is a callAnalysis document — which means History, AnalysisDetail, the teacher
// student page and the roster rollup all work unchanged. Unlike a human call
// there is no recording to fetch and no transcription to pay for: every turn
// was already transcribed on the way in.
exports.analyzeAiSession = onRequest(
  { secrets: [GROQ_API_KEY, DEEPSEEK_API_KEY], memory: "1GiB", timeoutSeconds: 300, invoker: "public" },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");

    let decoded;
    try {
      decoded = await verifyAuth(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const uid = decoded.uid;

    try {
      await enforceRateLimit(uid, "analyzeAiSession", 20, 60 * 60 * 1000);
    } catch {
      return res.status(429).json({ error: "Too many analyses in the last hour." });
    }

    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId required" });
    }

    const db = admin.firestore();
    const sessionRef = db.collection("aiSessions").doc(`${uid}_${sessionId}`);
    const analysisId = `${uid}_ai_${sessionId}`;
    const analysisRef = db.collection("callAnalysis").doc(analysisId);

    try {
      const snap = await sessionRef.get();
      if (!snap.exists) return res.status(404).json({ error: "Session not found" });
      const session = snap.data();
      if (session.uid !== uid) return res.status(403).json({ error: "Not your session" });
      if (session.status === "analyzed") {
        return res.status(200).json({ ok: true, analysisId, alreadyDone: true });
      }

      // Only the learner spoken words are graded. AInur turns are prompts, not
      // performance, and feeding them in would let the model grade its own
      // sentences and inflate the score.
      const studentText = (session.turns || [])
        .filter((t) => t.role === "student")
        .map((t) => String(t.text || "").trim())
        .filter(Boolean)
        .join(" ");

      const words = studentText ? studentText.split(/\s+/).length : 0;
      // Under roughly a minute of speech there is nothing to score, and a thin
      // report reads worse than no report. Same reasoning as the two-minute
      // floor on call analysis.
      if (words < 60) {
        await sessionRef.set({ status: "done", tooShort: true }, { merge: true });
        return res.status(200).json({ ok: false, reason: "too-short", words });
      }

      await analysisRef.set({
        status: "processing",
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      const userSnap = await db.collection("users").doc(uid).get();
      const u = userSnap.exists ? userSnap.data() : {};
      const lang = u.preferredLanguage === "tr" ? "tr" : "az";

      // Real speaking time, summed from the turns. This was estimated from the
      // word count at an assumed 120 wpm, which meant a slow speaker was told
      // they had spoken for half as long as they really had — and the pace
      // figure derived from it was circular, since it divided words by a
      // duration that had itself been computed from those words.
      const measured = (session.turns || [])
        .filter((t) => t.role === "student" && Number.isFinite(t.sec))
        .reduce((sum, t) => sum + t.sec, 0);
      const spokenSeconds = measured > 0 ? measured : Math.round((words / 120) * 60);

      const prompt = buildAnalysisPrompt(studentText.slice(0, MAX_TRANSCRIPT_CHARS), lang);
      const raw = await callAnalysisLLM(prompt, db);
      const analysis = normalizeAnalysis(raw, { analyzeSeconds: spokenSeconds, transcript: studentText });

      await analysisRef.set({
        ...analysis,
        transcript: studentText,
        status: "done",
        userId: uid,
        source: "ainur",
        activity: session.activity || "describe",
        peerName: "AInur",
        durationSeconds: spokenSeconds,
        analyzedSeconds: spokenSeconds,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      await sessionRef.set({ status: "analyzed", analysisId }, { merge: true });
      recordAiUsage(uid, { sessions: 1 });

      // The whole point of the feature: the teacher sees it. Same rollup a
      // human call writes, so the teacher page needs no special case.
      if (u.teacherId) {
        try {
          await db.collection("teachers").doc(u.teacherId).collection("roster").doc(uid).set({
            lastAnalysisAt: admin.firestore.FieldValue.serverTimestamp(),
            lastScore: analysis.overallScore || null,
            scoreSum: admin.firestore.FieldValue.increment(analysis.overallScore || 0),
            scoreCount: admin.firestore.FieldValue.increment(1),
            recentThemes: (analysis.errorThemes || []).slice(0, 6).map((t) => t.title).filter(Boolean),
          }, { merge: true });
        } catch (e) {
          console.warn("[analyzeAiSession] roster rollup failed:", e.message);
        }
      }

      // sendPushToUser resolves the token set and swallows its own failures.
      await sendPushToUser(db, uid, {
        key: "ai_report_ready",
        type: "analysis",
        url: "/history",
      });

      return res.status(200).json({ ok: true, analysisId });
    } catch (e) {
      console.error("[analyzeAiSession] error:", e);
      await analysisRef.set({ status: "failed", error: "analysis-failed", userId: uid }, { merge: true }).catch(() => {});
      return res.status(500).json({ error: "Analysis failed" });
    }
  },
);

// Speak one fixed line. No transcription, no model call — just a voice for a
// string the app already knows, so AInur can ASK the opening question out loud
// instead of only printing it. The client caches the audio per line, so each
// distinct sentence costs one synthesis on a device and nothing after that.
//
// Deliberately NOT free-form: an endpoint that will speak any text a client
// sends is a paid megaphone. Only lines the app itself ships are allowed.
// Every fixed line the app is allowed to have spoken. The allowlist exists so a
// client cannot turn this endpoint into free text-to-speech, and it is billed
// per character.
//
// ⚠️ THIS MUST MATCH THE CLIENT. DESCRIBE_PROMPT in src/pages/AiActivity.jsx is
// the line the describing activity asks for; changing the string there without
// adding it here returns 400 "Unknown line" and AInur goes COMPLETELY SILENT
// with nothing on screen to say why. That has already shipped once.
const SPEAKABLE_LINES = new Set([
  // The current describing opener -- keep in sync with DESCRIBE_PROMPT.
  "How can you describe this photo?",
  // The five per-picture openers this replaced. Kept because a client running
  // an older bundle still asks for them, and a cached device still holds them.
  "What can you see in this picture?",
  "How would you describe this picture?",
  "Tell me what is happening here.",
  "What do you notice first in this picture?",
  "Describe this picture for me. What is going on?",
]);

exports.speakLine = onRequest(
  { secrets: [DEEPGRAM_API_KEY], invoker: "public" },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");

    let decoded;
    try {
      decoded = await verifyAuth(req);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      await enforceRateLimit(decoded.uid, "speakLine", 60, 60 * 60 * 1000);
    } catch {
      return res.status(429).json({ error: "Too many requests." });
    }

    const { text } = req.body || {};
    // A free-talk greeting carries the day's topic, so it cannot be in a fixed
    // set. Allow it by shape instead: short, and matching the sentence the app
    // builds.
    const isGreeting = typeof text === "string"
      && /^Hello\. Today the topic is .{1,60}\. What do you think about it\?$/.test(text);
    if (!text || (!SPEAKABLE_LINES.has(text) && !isGreeting)) {
      return res.status(400).json({ error: "Unknown line" });
    }

    try {
      const ttsRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${DEEPGRAM_API_KEY.value()}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!ttsRes.ok) {
        console.warn("[speakLine] TTS failed:", await ttsRes.text());
        return res.status(502).json({ error: "Voice unavailable" });
      }
      const audioBase64 = Buffer.from(await ttsRes.arrayBuffer()).toString("base64");
      recordAiUsage(decoded.uid, { ttsChars: text.length });
      return res.status(200).json({ audioBase64 });
    } catch (e) {
      console.error("[speakLine] error:", e);
      return res.status(500).json({ error: "Voice unavailable" });
    }
  },
);


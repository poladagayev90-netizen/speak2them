const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const admin = require("firebase-admin");

admin.initializeApp();

const AGORA_APP_CERTIFICATE = defineSecret("AGORA_APP_CERTIFICATE");
const BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const BROADCAST_ADMIN_KEY = defineSecret("BROADCAST_ADMIN_KEY");

const AGORA_APP_ID = defineString("AGORA_APP_ID", {
  default: "ea7ad2e0c0bc4a98a35f3617931fa7ac",
});
const CHANNEL_LINK = defineString("TELEGRAM_CHANNEL_LINK", {
  default: "https://t.me/speak2them",
});
const CHANNEL_ID = defineString("TELEGRAM_CHANNEL_ID", {
  default: "@speak2them",
});
const ADMIN_TELEGRAM_ID = defineString("ADMIN_TELEGRAM_ID", {
  default: "5134853364",
});
const TELEGRAM_APP_URL = defineString("TELEGRAM_APP_URL", {
  default: "https://t.me/Speak2them_bot/app",
});

const telegramApiUrl = () => `https://api.telegram.org/bot${BOT_TOKEN.value()}/sendMessage`;
const DAILY_REMINDER_BATCH_SIZE = 500;
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

// ─── Agora Token ───────────────────────────────────────────────
exports.getAgoraToken = onRequest({ secrets: [AGORA_APP_CERTIFICATE] }, async (req, res) => {
  setCors(res, "GET, POST");

  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  try {
    await verifyAuth(req);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const channelName = req.body.channelName || req.query.channelName;
  if (!channelName) { res.status(400).json({ error: "channelName required" }); return; }

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

// ─── Telegram Webhook ─────────────────────────────────────────
exports.telegramWebhook = onRequest({ secrets: [BOT_TOKEN] }, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.send("ok");

  const chatId = message.chat.id;
  const text = message.text;

  if (text === "/start") {
    await admin.firestore().collection("telegramUsers").doc(String(chatId)).set({
      chatId,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await fetch(telegramApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🎙️ Speak2Them-ə xoş gəldin!\n\nKanalımıza qoşul: ${CHANNEL_LINK.value()}\n\nTətbiqi aç: ${TELEGRAM_APP_URL.value()}`,
        reply_markup: {
          inline_keyboard: [[
            { text: "📢 Kanala qoşul", url: CHANNEL_LINK.value() },
            { text: "🚀 Tətbiqi aç", url: TELEGRAM_APP_URL.value() },
          ]],
        },
      }),
    });
  }

  res.send("ok");
});

// ─── Broadcast ────────────────────────────────────────────────
exports.broadcastMessage = onRequest({ secrets: [BOT_TOKEN, BROADCAST_ADMIN_KEY] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.headers["x-admin-key"] !== BROADCAST_ADMIN_KEY.value()) return res.status(403).send("Forbidden");

  const { text } = req.body;
  if (!text) return res.status(400).send("text required");

  await fetch(telegramApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHANNEL_ID.value(), text,
      reply_markup: { inline_keyboard: [[
        { text: "🚀 Tətbiqi aç", url: TELEGRAM_APP_URL.value() },
        { text: "📢 Kanala qoşul", url: CHANNEL_LINK.value() },
      ]]},
    }),
  }).catch(() => {});

  const [tgUsers, appUsers] = await Promise.all([
    admin.firestore().collection("telegramUsers").get(),
    admin.firestore().collection("users").get(),
  ]);

  const chatIds = new Set();
  tgUsers.docs.forEach(d => { if (d.data().chatId) chatIds.add(String(d.data().chatId)); });
  appUsers.docs.forEach(d => { if (d.data().telegramId) chatIds.add(String(d.data().telegramId)); });

  const promises = [...chatIds].map(chatId =>
    fetch(telegramApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, text,
        reply_markup: { inline_keyboard: [[
          { text: "🚀 Tətbiqi aç", url: TELEGRAM_APP_URL.value() },
          { text: "📢 Kanala qoşul", url: CHANNEL_LINK.value() },
        ]]},
      }),
    }).catch(() => {})
  );

  await Promise.allSettled(promises);
  res.send({ sent: chatIds.size + 1 });
});

// ─── Zəng Bildirişi ───────────────────────────────────────────
exports.sendCallNotification = onRequest({ secrets: [BOT_TOKEN] }, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { telegramId, callerName, callerId, receiverId } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });
  if (!callerId || !receiverId) return res.status(400).json({ error: "callerId and receiverId required" });
  if (decoded.uid !== callerId) return res.status(403).json({ error: "Forbidden" });

  try {
    await fetch(telegramApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: `📞 *${callerName}* sizi Speak2Them-də zəng edir!\n\nQəbul etmək üçün tətbiqi açın 👇`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "🎙️ Tətbiqi aç", url: TELEGRAM_APP_URL.value() }
        ]]},
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Premium Sorğusu — adminə xəbər ver ──────────────────────
exports.notifyPremiumRequest = onRequest({ secrets: [BOT_TOKEN] }, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userName, userEmail, userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });
  if (decoded.uid !== userId) return res.status(403).json({ error: "Forbidden" });

  try {
    await fetch(telegramApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_ID.value(),
        text: `💰 *Yeni Premium Sorğusu!*\n\n👤 Ad: ${userName}\n📧 Email: ${userEmail}\n🆔 UID: ${userId}\n\nAdmin paneldən aktivləşdir 👇`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "🛡️ Admin Panel", url: `${TELEGRAM_APP_URL.value()}/admin` }
        ]]},
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Premium Aktivləşdi — istifadəçiyə xəbər ver ─────────────
exports.notifyPremiumActivated = onRequest({ secrets: [BOT_TOKEN] }, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).send("");

  let decoded;
  try {
    decoded = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (decoded.uid !== ADMIN_UID) return res.status(403).json({ error: "Forbidden" });

  const { telegramId, userName } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });

  try {
    await fetch(telegramApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: `👑 *${userName}*, Premium üzvlüyünüz aktivləşdirildi!\n\n✅ Bütün premium xüsusiyyətlər indi sizin üçün açıqdır.\n\nTətbiqi açın və zövq alın 🎙️`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "🚀 Tətbiqi aç", url: TELEGRAM_APP_URL.value() }
        ]]},
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Daily Practice Reminder ──────────────────────────────────
exports.dailyReminder = onSchedule({
  schedule: "0 21 * * *",
  timeZone: "Asia/Baku",
}, async () => {
  const usersSnap = await admin.firestore().collection("users").get();
  const usersWithTokens = usersSnap.docs
    .map(docSnap => ({ ref: docSnap.ref, ...docSnap.data() }))
    .filter(user => typeof user.fcmToken === "string" && user.fcmToken.trim());

  let sent = 0;
  let failed = 0;
  const invalidTokenRefs = [];

  for (let i = 0; i < usersWithTokens.length; i += DAILY_REMINDER_BATCH_SIZE) {
    const batch = usersWithTokens.slice(i, i + DAILY_REMINDER_BATCH_SIZE);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch.map(user => user.fcmToken),
      notification: {
        title: "Speak2Them practice time",
        body: "Come practice English with someone today.",
      },
      data: {
        type: "daily_reminder",
        url: "/",
      },
    });

    sent += response.successCount;
    failed += response.failureCount;

    response.responses.forEach((result, index) => {
      const code = result.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokenRefs.push(batch[index].ref);
      }
    });
  }

  await Promise.all(invalidTokenRefs.map(ref => ref.update({
    fcmToken: admin.firestore.FieldValue.delete(),
  }).catch(() => null)));

  console.log("Daily reminder complete", {
    users: usersSnap.size,
    tokens: usersWithTokens.length,
    sent,
    failed,
    invalidTokensRemoved: invalidTokenRefs.length,
  });
});
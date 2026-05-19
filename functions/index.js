const functions = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const admin = require("firebase-admin");

admin.initializeApp();

const APP_ID = "98299e33a32f4137a94daacc5422c92e";
const APP_CERTIFICATE = "ea7ad2e0c0bc4a98a35f3617931fa7ac";
const BOT_TOKEN = "8771591170:AAEw_6eiyv2n8RKT2L-oS_KEIlQGxM2ZPYA";
const CHANNEL_LINK = "https://t.me/speak2them";
const CHANNEL_ID = "@speak2them";
const ADMIN_TELEGRAM_ID = "YOUR_TELEGRAM_ID"; // öz telegram id-ni yaz

// ─── Agora Token ───────────────────────────────────────────────
exports.getAgoraToken = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  const channelName = req.body.channelName || req.query.channelName;
  if (!channelName) { res.status(400).json({ error: "channelName required" }); return; }

  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID, APP_CERTIFICATE, channelName, 0, role, privilegeExpireTime
  );

  res.status(200).json({ token });
});

// ─── Telegram Webhook ─────────────────────────────────────────
exports.telegramWebhook = onRequest(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.send("ok");

  const chatId = message.chat.id;
  const text = message.text;

  if (text === "/start") {
    await admin.firestore().collection("telegramUsers").doc(String(chatId)).set({
      chatId,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🎙️ Speak2Them-ə xoş gəldin!\n\nKanalımıza qoşul: ${CHANNEL_LINK}\n\nTətbiqi aç: https://t.me/Speak2them_bot/app`,
        reply_markup: {
          inline_keyboard: [[
            { text: "📢 Kanala qoşul", url: CHANNEL_LINK },
            { text: "🚀 Tətbiqi aç", url: "https://t.me/Speak2them_bot/app" },
          ]],
        },
      }),
    });
  }

  res.send("ok");
});

// ─── Broadcast ────────────────────────────────────────────────
exports.broadcastMessage = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-admin-key");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.headers["x-admin-key"] !== "speak2them2024") return res.status(403).send("Forbidden");

  const { text } = req.body;
  if (!text) return res.status(400).send("text required");

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHANNEL_ID, text,
      reply_markup: { inline_keyboard: [[
        { text: "🚀 Tətbiqi aç", url: "https://t.me/Speak2them_bot/app" },
        { text: "📢 Kanala qoşul", url: CHANNEL_LINK },
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
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, text,
        reply_markup: { inline_keyboard: [[
          { text: "🚀 Tətbiqi aç", url: "https://t.me/Speak2them_bot/app" },
          { text: "📢 Kanala qoşul", url: CHANNEL_LINK },
        ]]},
      }),
    }).catch(() => {})
  );

  await Promise.allSettled(promises);
  res.send({ sent: chatIds.size + 1 });
});

// ─── Zəng Bildirişi ───────────────────────────────────────────
exports.sendCallNotification = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  const { telegramId, callerName } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: `📞 *${callerName}* sizi Speak2Them-də zəng edir!\n\nQəbul etmək üçün tətbiqi açın 👇`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "🎙️ Tətbiqi aç", url: "https://t.me/Speak2them_bot/app" }
        ]]},
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Premium Sorğusu — adminə xəbər ver ──────────────────────
exports.notifyPremiumRequest = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  const { userName, userEmail, userId } = req.body;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_TELEGRAM_ID,
        text: `💰 *Yeni Premium Sorğusu!*\n\n👤 Ad: ${userName}\n📧 Email: ${userEmail}\n🆔 UID: ${userId}\n\nAdmin paneldən aktivləşdir 👇`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "🛡️ Admin Panel", url: "https://t.me/Speak2them_bot/app/admin" }
        ]]},
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Premium Aktivləşdi — istifadəçiyə xəbər ver ─────────────
exports.notifyPremiumActivated = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  const { telegramId, userName } = req.body;
  if (!telegramId) return res.status(400).json({ error: "telegramId required" });

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: `👑 *${userName}*, Premium üzvlüyünüz aktivləşdirildi!\n\n✅ Bütün premium xüsusiyyətlər indi sizin üçün açıqdır.\n\nTətbiqi açın və zövq alın 🎙️`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[
          { text: "🚀 Tətbiqi aç", url: "https://t.me/Speak2them_bot/app" }
        ]]},
      }),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
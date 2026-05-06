const functions = require("firebase-functions");
const { RtcTokenBuilder, RtcRole } = require("agora-token");

const APP_ID = "98299e33a32f4137a94daacc5422c92e";
const APP_CERTIFICATE = "ea7ad2e0c0bc4a98a35f3617931fa7ac";

exports.getAgoraToken = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const channelName = req.body.channelName || req.query.channelName;

  if (!channelName) {
    res.status(400).json({ error: "channelName required" });
    return;
  }

  const role = RtcRole.PUBLISHER;
  const expireTime = 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    0,
    role,
    privilegeExpireTime
  );

  res.status(200).json({ token });
});
const BOT_TOKEN = '8771591170:AAEw_6eiyv2n8RKT2L-oS_KEIlQGxM2ZPYA';
const CHANNEL_LINK = 'https://t.me/speak2them';

exports.telegramWebhook = onRequest(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.send('ok');

  const chatId = message.chat.id;
  const text = message.text;

  if (text === '/start') {
    await admin.firestore().collection('telegramUsers').doc(String(chatId)).set({
      chatId,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🎙️ Speak2Them-ə xoş gəldin!\n\nKanalımıza qoşul: ${CHANNEL_LINK}\n\nTətbiqi aç: https://t.me/Speak2them_bot/app`,
        reply_markup: {
          inline_keyboard: [[
            { text: '📢 Kanala qoşul', url: CHANNEL_LINK },
            { text: '🚀 Tətbiqi aç', url: 'https://t.me/Speak2them_bot/app' }
          ]]
        }
      })
    });
  }

  res.send('ok');
});

exports.broadcastMessage = onRequest(async (req, res) => {
  if (req.headers['x-admin-key'] !== 'speak2them2024') {
    return res.status(403).send('Forbidden');
  }

  const { text } = req.body;
  const users = await admin.firestore().collection('telegramUsers').get();

  const promises = users.docs.map(doc => {
    const { chatId } = doc.data();
    return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [[
            { text: '🚀 Tətbiqi aç', url: 'https://t.me/Speak2them_bot/app' }
          ]]
        }
      })
    });
  });

  await Promise.allSettled(promises);
  res.send({ sent: users.size });
});
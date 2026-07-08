const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString } = require("firebase-functions/params");
const { RtcTokenBuilder, RtcRole } = require("agora-token");
const admin = require("firebase-admin");

admin.initializeApp();

const AGORA_APP_CERTIFICATE = defineSecret("AGORA_APP_CERTIFICATE");
const BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const BROADCAST_ADMIN_KEY = defineSecret("BROADCAST_ADMIN_KEY");
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const DEEPSEEK_API_KEY = defineSecret("DEEPSEEK_API_KEY");
const DEEPGRAM_API_KEY = defineSecret("DEEPGRAM_API_KEY");

const AGORA_APP_ID = defineString("AGORA_APP_ID", {
  default: "98299e33a32f4137a94daacc5422c92e",
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

const ALL_TOPICS = [
  "Travel ✈️", "Technology 💻", "Food & Culture 🍽️", "Education 📚", 
  "Health & Wellbeing 🏃", "Environment 🌍", "Work & Career 💼", 
  "Social Media 📱", "Money & Finances 💰", "Films & Series 🎬", 
  "Music 🎵", "Famous People & Celebrities ⭐", "Hobbies & Free Time 🎨", 
  "Fashion & Style 👗", "Cartoons & Animation 🎭", "Fear & Phobias 😱", 
  "Relationships & Friendship ❤️", "Sports & Competition 🏆", "Animals & Pets 🐾", 
  "Culture & Traditions 🌐", "Science & Space 🚀", "City vs Countryside 🏙️", 
  "Books & Reading 📖", "Language & Communication 🗣️", "Shopping & Consumerism 🛍️", 
  "Dreams & Ambitions 🌟", "History & Past Events 🏛️", "Future & Predictions 🔮"
];

function getTodayTopic() {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return ALL_TOPICS[daysSinceEpoch % ALL_TOPICS.length];
}

// ─── Topic Practice Reminder ──────────────────────────────────
exports.topicReminder = onSchedule({
  schedule: "0 10,15 * * *",
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
    const todayTopic = getTodayTopic();
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch.map(user => user.fcmToken),
      notification: {
        title: `Günlük Mövzu: ${todayTopic}`,
        body: "Daxil ol və bu mövzuda öyrəndiklərini təcrübədən keçir! Səni gözləyirlər.",
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

  const { peerId, updates } = req.body;
  if (!peerId || typeof peerId !== "string" || !updates || typeof updates !== "object") {
    return res.status(400).json({ error: "peerId and updates required" });
  }
  if (peerId === decoded.uid) {
    return res.status(403).json({ error: "Cannot update own stats via this endpoint" });
  }

  const peerRef = admin.firestore().collection("users").doc(peerId);
  const peerSnap = await peerRef.get().catch(() => null);
  if (!peerSnap || !peerSnap.exists) {
    return res.status(404).json({ error: "Peer not found" });
  }
  const peerData = peerSnap.data() || {};

  // Yalnız icazə verilən sahələrin yenilənməsinə zəmanət veririk:
  const allowedKeys = ["rating", "ratingCount", "receivedFiveStar", "badges", "bonusMinutes"];
  const safeUpdates = {};
  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      safeUpdates[key] = updates[key];
    }
  }

  // Dəyər validasiyası: rating yalnız 1-5 ulduzluq bir səs qədər arta bilər,
  // ratingCount yalnız 1 vahid; qalan sahələr tip və sərhəd yoxlamasından keçir.
  if (safeUpdates.rating !== undefined) {
    const prevRating = typeof peerData.rating === "number" ? peerData.rating : 0;
    const delta = safeUpdates.rating - prevRating;
    if (typeof safeUpdates.rating !== "number" || !Number.isFinite(delta) || delta < 1 || delta > 5) {
      return res.status(400).json({ error: "Invalid rating value" });
    }
  }
  if (safeUpdates.ratingCount !== undefined) {
    const prevCount = typeof peerData.ratingCount === "number" ? peerData.ratingCount : 0;
    if (safeUpdates.ratingCount !== prevCount + 1) {
      return res.status(400).json({ error: "Invalid ratingCount value" });
    }
  }
  if (safeUpdates.receivedFiveStar !== undefined && safeUpdates.receivedFiveStar !== true) {
    return res.status(400).json({ error: "Invalid receivedFiveStar value" });
  }
  if (safeUpdates.badges !== undefined) {
    const badgesValid = Array.isArray(safeUpdates.badges)
      && safeUpdates.badges.length <= 100
      && safeUpdates.badges.every((b) => typeof b === "string" && b.length <= 64);
    if (!badgesValid) {
      return res.status(400).json({ error: "Invalid badges value" });
    }
  }
  if (safeUpdates.bonusMinutes !== undefined) {
    if (typeof safeUpdates.bonusMinutes !== "number"
      || safeUpdates.bonusMinutes < 0
      || safeUpdates.bonusMinutes > 10000) {
      return res.status(400).json({ error: "Invalid bonusMinutes value" });
    }
  }

  if (updates.badgeUpdatedAt === "SERVER_TIMESTAMP") {
    safeUpdates.badgeUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  if (Object.keys(safeUpdates).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    await peerRef.update(safeUpdates);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── AI Quiz Generation (DeepSeek proxy) ──────────────────────────
exports.generateQuiz = onRequest({ secrets: [DEEPSEEK_API_KEY] }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
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

  try {
    const sampleSize = Math.min(translatedItems.length, 5);
    const shuffled = [...translatedItems].sort(() => 0.5 - Math.random());
    const selectedItems = shuffled.slice(0, sampleSize);

    const wordsList = selectedItems.map((w) => `'${w.original}' (translated to '${w.translated}')`).join(", ");

    const prompt = `
      You are an English language teacher for an Azerbaijani student.
      The student has just learned the following English words/phrases during a conversation:
      ${wordsList}

      Generate a quick multiple-choice quiz (1 question per word) to test their memory.
      The questions must be in Azerbaijani. The options can be either in English or Azerbaijani depending on what is being asked.

      Return ONLY a valid JSON object with a "quiz" key containing an array of questions. Format:
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

    const deepseekRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY.value()}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!deepseekRes.ok) {
      const err = await deepseekRes.text().catch(() => "");
      console.error("[generateQuiz] DeepSeek error:", deepseekRes.status, err);
      return res.status(500).json({ error: `DeepSeek error: ${deepseekRes.status}` });
    }

    const data = await deepseekRes.json();
    const responseText = data.choices?.[0]?.message?.content;
    if (!responseText) return res.status(500).json({ error: "No response from DeepSeek" });

    const parsed = parseJsonLoose(responseText);

    // Unwrap a single-key object ({ quiz: [...] }) into the array itself
    let quizData = parsed;
    if (!Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
        quizData = parsed[keys[0]];
      }
    }

    res.status(200).json({ quiz: quizData });
  } catch (error) {
    console.error("[generateQuiz] Function error:", error);
    res.status(500).json({ error: error.message });
  }
});

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

  const { base64Audio, history = [], userLevel = 'B1', topic = 'General' } = req.body;
  if (!base64Audio) {
    return res.status(400).json({ error: "base64Audio required" });
  }

  try {
    const audioBuffer = Buffer.from(base64Audio, "base64");
    if (audioBuffer.length < 100) {
      return res.status(400).json({ error: "Audio file is too small." });
    }
    const blob = new Blob([audioBuffer], { type: "audio/webm" });

    // 1. Transcription via Groq Whisper
    const groqForm = new FormData();
    groqForm.append("file", blob, "audio.webm");
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
// 80% of Groq's free-tier 7200 audio-seconds/hour, rolling window.
const ANALYSIS_HOURLY_AUDIO_BUDGET = 5760;

const ANALYSIS_PROMPT = `Sən təcrübəli, dəqiq İngilis dili müəllimisən. Aşağıda bir Azərbaycanlı tələbənin İngiliscə danışığının transkripti var.

TRANSKRIPT:
"""{{TRANSCRIPT}}"""

Vəzifən: bu danışığı təhlil et və nəticəni YALNIZ bir JSON obyekti kimi qaytar. Markdown, izah və ya əlavə mətn yazma.

Qaydalar:
- overallScore və fluencyScore: 0-100 arası tam ədəd.
- encouragement: 1 qısa ruhlandırıcı cümlə (Azərbaycanca).
- grammarFixes: YALNIZ qrammatik və ya leksik SƏHVİ olan cümlələr, ƏN ÇOX 6 ədəd (ən vacibləri). Düzgün cümlələri ƏSLA daxil etmə. Hər element: original (tələbənin dediyi səhv cümlə), corrected (düzgün variant), why (səhvin izahı, Azərbaycanca, maksimum 12 söz). Səhv yoxdursa boş massiv.
- vocabularyUsed: tələbənin işlətdiyi diqqətəlayiq İngilis sözləri, ən çox 10 ədəd.
- vocabularySuggestions: tələbənin işlətdiyindən daha uyğun/zəngin İngilis sözləri, ən çox 5 ədəd. Hər element: word (İngiliscə), meaning (Azərbaycanca qısa məna, maksimum 6 söz).
- exampleSentences: bu mövzuda düzgün qurulmuş 2-3 nümunə İngilis cümləsi.
- Cavabı qısa saxla: heç bir mətn sahəsi bir cümlədən uzun olmasın.
- Uydurma etmə; yalnız transkriptə əsaslan.`;

// Whisper can return very long transcripts; the JSON answer must still fit in
// the completion budget, so the model only sees a bounded slice.
const MAX_TRANSCRIPT_CHARS = 6000;

// Strict schema enforced at the Groq API level (structured outputs).
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallScore", "fluencyScore", "encouragement", "grammarFixes",
    "vocabularyUsed", "vocabularySuggestions", "exampleSentences"],
  properties: {
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    fluencyScore: { type: "integer", minimum: 0, maximum: 100 },
    encouragement: { type: "string" },
    grammarFixes: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "corrected", "why"],
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    vocabularyUsed: { type: "array", maxItems: 10, items: { type: "string" } },
    vocabularySuggestions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "meaning"],
        properties: {
          word: { type: "string" },
          meaning: { type: "string" },
        },
      },
    },
    exampleSentences: { type: "array", maxItems: 3, items: { type: "string" } },
  },
};

function isRetryableStatus(httpStatus) {
  return httpStatus === 429 || httpStatus >= 500;
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

// Coerces whatever the model returned into a guaranteed, bounded shape so the
// frontend never sees a malformed analysis, even on a partial response.
function normalizeAnalysis(raw, { analyzeSeconds, transcript }) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const clampScore = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  };
  const asStr = (v) => (typeof v === "string" ? v.trim() : "");

  const grammarFixes = (Array.isArray(obj.grammarFixes) ? obj.grammarFixes : [])
    .map((f) => ({ original: asStr(f?.original), corrected: asStr(f?.corrected), why: asStr(f?.why) }))
    // Drop entries where the "fix" equals the original — i.e. correct sentences.
    .filter((f) => f.original && f.corrected && f.original !== f.corrected)
    .slice(0, 8);

  const vocabularyUsed = (Array.isArray(obj.vocabularyUsed) ? obj.vocabularyUsed : [])
    .map(asStr).filter(Boolean).slice(0, 15);

  const vocabularySuggestions = (Array.isArray(obj.vocabularySuggestions) ? obj.vocabularySuggestions : [])
    .map((v) => ({ word: asStr(v?.word), meaning: asStr(v?.meaning) }))
    .filter((v) => v.word).slice(0, 6);

  const exampleSentences = (Array.isArray(obj.exampleSentences) ? obj.exampleSentences : [])
    .map(asStr).filter(Boolean).slice(0, 3);

  return {
    overallScore: clampScore(obj.overallScore),
    fluencyScore: clampScore(obj.fluencyScore),
    encouragement: asStr(obj.encouragement) || "Yaxşı iş! Davam et.",
    grammarFixes,
    vocabularyUsed,
    vocabularySuggestions,
    exampleSentences,
    speakingPace: computeSpeakingPace(transcript, analyzeSeconds),
  };
}

// Groq chat with strict JSON, in-call retries (max 3) and a schema→json_object
// fallback, so json_validate_failed and malformed output self-heal instead of
// failing the ticket permanently.
// Escalating completion budgets: the observed production failure was
// "max completion tokens reached before generating a valid document" — the
// answer was cut mid-JSON, so retrying with the same budget can never succeed.
const ANALYSIS_MAX_TOKENS = [2500, 3500, 4096];

async function callGroqChat(userContent) {
  const messages = [{ role: "user", content: userContent }];
  let useSchema = true;
  let lastErr = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    });

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

// Long calls are analyzed partially to keep the queue moving on the free
// Groq tier: short calls in full, longer ones one third (min 5 minutes).
function effectiveAnalyzeSeconds(audioSeconds) {
  if (!audioSeconds || audioSeconds <= 300) return audioSeconds || 0;
  return Math.max(300, Math.round(audioSeconds / 3));
}

// Data-only push to one user's device (the messaging SW displays it and
// routes clicks via data.url); prunes dead tokens. Data-only avoids the
// SDK double-display problem that notification payloads can cause.
async function sendPushToUser(db, uid, { title, body, type, url }) {
  const userRef = db.collection("users").doc(uid);
  try {
    const userSnap = await userRef.get();
    const token = userSnap.exists ? userSnap.data().fcmToken : null;
    if (typeof token !== "string" || !token.trim()) return;
    await admin.messaging().send({
      token,
      data: { title, body, type, url },
    });
  } catch (error) {
    const code = error.code;
    if (
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered"
    ) {
      await userRef.update({
        fcmToken: admin.firestore.FieldValue.delete(),
      }).catch(() => null);
    } else {
      console.warn("[Push] send failed:", uid, error.message);
    }
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

async function runGroqAnalysis(audioBuffer, analyzeSeconds) {
  const blob = new Blob([audioBuffer], { type: "audio/webm" });
  const groqForm = new FormData();
  groqForm.append("file", blob, "audio.webm");
  groqForm.append("model", "whisper-large-v3-turbo");
  groqForm.append("response_format", "json");

  const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_API_KEY.value()}` },
    body: groqForm,
  });
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

  // Recover tickets stuck in processing (worker crash / timeout).
  const processingSnap = await queue.where("status", "==", "processing").get();
  const stuckCutoff = Date.now() - ANALYSIS_STUCK_MS;
  for (const docSnap of processingSnap.docs) {
    const startedMs = docSnap.data().processingStartedAt
      ? docSnap.data().processingStartedAt.toMillis() : 0;
    if (startedMs < stuckCutoff) {
      await docSnap.ref.update({ status: "pending" });
      console.warn("[AnalysisQueue] Reset stuck ticket:", docSnap.id);
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
    const ticket = await claimTicket(db, docSnap.ref);
    if (!ticket) {
      console.log("[AnalysisQueue] Skipped (budget or already claimed):", docSnap.id);
      continue;
    }

    const analysisRef = db.collection("callAnalysis").doc(ticket.id);
    try {
      await analysisRef.set({ status: "processing" }, { merge: true });

      const [audioBuffer] = await admin.storage().bucket().file(ticket.storagePath).download();

      // Partial analysis: a WebM byte-prefix stays decodable (header is at
      // the start; Opus speech is ~constant bitrate, so bytes ≈ time).
      const totalSeconds = ticket.audioSeconds || 0;
      const analyzeSeconds = ticket.analyzeSeconds || totalSeconds;
      let analysisBuffer = audioBuffer;
      if (totalSeconds > 0 && analyzeSeconds < totalSeconds) {
        analysisBuffer = audioBuffer.subarray(
          0, Math.ceil(audioBuffer.length * (analyzeSeconds / totalSeconds)));
      }

      const { transcript, analysis } = await runGroqAnalysis(analysisBuffer, analyzeSeconds);

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
        await ticket.ref.update({
          status: "failed",
          retryCount,
          lastError: String(error.message).slice(0, 500),
        });
        await analysisRef.set({
          status: "failed",
          error: String(error.message).slice(0, 300),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          userId: ticket.uid,
        }, { merge: true });
        await admin.storage().bucket().file(ticket.storagePath).delete().catch(() => null);
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

// One reminder push to every registered device, 15 min before the session.
async function broadcastSessionReminder(db, startLabel) {
  const usersSnap = await db.collection("users").get();
  const usersWithTokens = usersSnap.docs
    .map((d) => ({ ref: d.ref, ...d.data() }))
    .filter((u) => typeof u.fcmToken === "string" && u.fcmToken.trim());

  let sent = 0;
  const invalidTokenRefs = [];
  for (let i = 0; i < usersWithTokens.length; i += DAILY_REMINDER_BATCH_SIZE) {
    const batch = usersWithTokens.slice(i, i + DAILY_REMINDER_BATCH_SIZE);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: batch.map((u) => u.fcmToken),
      data: {
        title: "Axşam sessiyasına az qaldı! 🧪",
        body: `Sessiya ${startLabel}-da başlayır — günün mövzusuna bax və hazır ol.`,
        type: "session_reminder",
        url: "/",
      },
    });
    sent += response.successCount;
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
  await Promise.all(invalidTokenRefs.map((ref) => ref.update({
    fcmToken: admin.firestore.FieldValue.delete(),
  }).catch(() => null)));
  console.log("[SessionMatch] reminder sent:", sent, "invalidTokensRemoved:", invalidTokenRefs.length);
}

exports.matchSessionQueue = onSchedule({
  schedule: "every 1 minutes",
  timeZone: "Asia/Baku",
}, async () => {
  const db = admin.firestore();

  const cfgSnap = await db.collection("appConfig").doc("session").get();
  if (!cfgSnap.exists || !cfgSnap.data().enabled) return;
  const cfg = { hour: 21, minute: 0, bufferMinutes: 10, ...cfgSnap.data() };

  const pad = (n) => String(n).padStart(2, "0");
  const bakuDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku" }).format(new Date());
  const startMs = Date.parse(`${bakuDate}T${pad(cfg.hour)}:${pad(cfg.minute)}:00+04:00`);
  const endMs = startMs + cfg.bufferMinutes * 60 * 1000;
  const now = Date.now();

  // Reminder window: 15 min before start, sent once (guarded by marker doc).
  if (now >= startMs - 15 * 60 * 1000 && now < startMs) {
    const remRef = db.collection("sessionRuns").doc(`${bakuDate}_reminder`);
    const remClaimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(remRef);
      if (snap.exists) return false;
      tx.set(remRef, { sentAt: admin.firestore.FieldValue.serverTimestamp() });
      return true;
    });
    if (remClaimed) {
      await broadcastSessionReminder(db, `${pad(cfg.hour)}:${pad(cfg.minute)}`);
    }
    return;
  }

  if (now < endMs) return;

  const runRef = db.collection("sessionRuns").doc(bakuDate);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(runRef);
    if (snap.exists) return false;
    tx.set(runRef, { startedAt: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;

  try {
    const waitingSnap = await db.collection("matchQueue")
      .where("status", "==", "waiting_session")
      .where("sessionId", "==", bakuDate)
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
    console.log("[SessionMatch]", bakuDate, "joined:", allWaiting.length, "ghosts:", ghosts.length);
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

    // 3 writes per pair, 2 per leftover — chunk under the 500-write limit.
    const ops = [];
    for (const [a, b] of pairs) {
      const callId = `call_${[a.uid, b.uid].sort().join("_")}`;
      ops.push((batch) => {
        batch.set(db.collection("calls").doc(callId), {
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
        batch.update(a.ref, {
          status: "matched", matchedWith: b.uid, callId,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.update(b.ref, {
          status: "matched", matchedWith: a.uid, callId,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }
    for (const u of leftover) {
      ops.push((batch) => {
        batch.update(u.ref, { status: "unmatched" });
        batch.set(db.collection("users").doc(u.uid), {
          bonusMinutes: admin.firestore.FieldValue.increment(5),
        }, { merge: true });
      });
    }
    for (const u of ghosts) {
      ops.push((batch) => {
        batch.update(u.ref, { status: "unmatched", ghost: true });
      });
    }

    const OPS_PER_BATCH = 150; // ≤3 writes each → max 450 writes per batch
    for (let i = 0; i < ops.length; i += OPS_PER_BATCH) {
      const batch = db.batch();
      ops.slice(i, i + OPS_PER_BATCH).forEach((apply) => apply(batch));
      await batch.commit();
    }

    console.log("[SessionMatch] pairs:", pairs.length, "unmatched:", leftover.length);
  } catch (error) {
    // Release the run marker so the next tick can retry the whole pass.
    await runRef.delete().catch(() => null);
    throw error;
  }
});

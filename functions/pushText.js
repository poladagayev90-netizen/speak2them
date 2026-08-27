// Push notification copy, per language.
//
// Every user-facing push used to be a hardcoded Azerbaijani string next to its
// call site. Turkish users — the second market — got Azerbaijani notifications
// even though their report language was already set to Turkish, and anyone on
// an English device got Azerbaijani too. The strings now live here, keyed, and
// the resolver picks the language from the user document.
//
// COST NOTE: resolving the language costs ZERO extra Firestore reads.
// sendPushToUser already fetches users/{uid} on every send (it needs the legacy
// fcmToken field), so the language comes off a document that was loaded anyway.
// Callers that already hold the user document (streakReminder, topicReminder,
// broadcastSessionReminder) pass the resolved language in instead.

const SUPPORTED = ["az", "tr", "en"];
const DEFAULT_LANG = "az";

// Language of the notifications for one user, from their already-loaded doc.
//
//   appLanguage       — what the interface/device is in (az | tr | en)
//   preferredLanguage — the analysis-report language (az | tr only)
//
// appLanguage wins because it is the broader signal: someone can read their
// grammar feedback in Azerbaijani while their phone and the interface are in
// English. Falling back to preferredLanguage keeps every existing user — who
// has no appLanguage field yet — on the language they already chose.
function pushLang(userData) {
  const d = userData || {};
  if (SUPPORTED.includes(d.appLanguage)) return d.appLanguage;
  if (SUPPORTED.includes(d.preferredLanguage)) return d.preferredLanguage;
  return DEFAULT_LANG;
}

// ─── Time labels ────────────────────────────────────────────────
// "Bu gün 14:00" / "Bugün 14:00" / "Today 14:00", in the RECIPIENT's timezone.
//
// The schedule itself is absolute (slot.startMs), but the hour printed in a
// push has to match the hour the app prints on screen, and the app formats in
// the device's own zone. Without this, a user in Istanbul read "14:00" in the
// notification and "13:00" on the practice board for the very same call.
// users/{uid}.timeZone is written by the client (App.js) on sign-in; when it is
// missing we fall back to Baku, where the schedule is authored.
const TZ_FALLBACK = "Asia/Baku";
const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_WORDS = {
  az: { today: "Bu gün", tomorrow: "Sabah" },
  tr: { today: "Bugün", tomorrow: "Yarın" },
  en: { today: "Today", tomorrow: "Tomorrow" },
};

function zonedFormat(ms, timeZone, opts) {
  try {
    return new Intl.DateTimeFormat(opts.locale, { timeZone, ...opts.fmt }).format(new Date(ms));
  } catch {
    // An unknown/garbage zone string must not kill the notification.
    return new Intl.DateTimeFormat(opts.locale, { timeZone: TZ_FALLBACK, ...opts.fmt }).format(new Date(ms));
  }
}

const zonedDateStr = (ms, tz) => zonedFormat(ms, tz, { locale: "en-CA", fmt: {} });
const zonedHour = (ms, tz) => zonedFormat(ms, tz, {
  locale: "en-GB", fmt: { hour: "2-digit", minute: "2-digit", hour12: false },
});

// `startMs` is the slot's absolute start; `timeZone` an IANA zone string.
function slotTimeLabel(startMs, lang, timeZone, nowMs = Date.now()) {
  const tz = timeZone || TZ_FALLBACK;
  const words = DAY_WORDS[lang] || DAY_WORDS[DEFAULT_LANG];
  const hh = zonedHour(startMs, tz);
  const day = zonedDateStr(startMs, tz);
  if (day === zonedDateStr(nowMs, tz)) return `${words.today} ${hh}`;
  if (day === zonedDateStr(nowMs + DAY_MS, tz)) return `${words.tomorrow} ${hh}`;
  return `${day} ${hh}`;
}

// Just the clock time, in the recipient's zone ("14:00").
const hourOnlyLabel = (startMs, timeZone) => zonedHour(startMs, timeZone || TZ_FALLBACK);

// ─── Copy ───────────────────────────────────────────────────────
// Placeholder names, kept per language so a body never mixes two languages in
// one sentence when a real name is missing.
const FALLBACK = {
  az: { peer: "Partnyorunuz", someone: "Kimsə", teacher: "Müəlliminiz", student: "Şagirdiniz", member: "Üzv", time: "yeni" },
  tr: { peer: "Partneriniz", someone: "Biri", teacher: "Öğretmeniniz", student: "Öğrenciniz", member: "Üye", time: "yeni" },
  en: { peer: "your partner", someone: "Someone", teacher: "Your teacher", student: "Your student", member: "Member", time: "the new time" },
};

// Each builder takes the interpolation bag `v` plus the resolved fallbacks `f`.
const STRINGS = {
  az: {
    incoming_call: (v) => ({ title: `📞 ${v.callerName} sizə zəng edir`, body: "Qəbul etmək üçün tətbiqi açın" }),
    premium_activated: (v, f) => ({ title: "👑 Premium aktivləşdirildi", body: `${v.userName || f.member}, bütün premium xüsusiyyətlər indi sizin üçün açıqdır!` }),
    daily_reminder: (v) => ({ title: `💬 ${v.topic}`, body: v.question ? `${v.question} — Cavabını düşün və daxil ol!` : "Daxil ol və bu mövzuda öyrəndiklərini təcrübədən keçir!" }),
    streak_urgent: (v) => ({ title: "⚠️ Streak-in bu gecə sönəcək!", body: `${v.streak} günlük əziyyətin gecə yarısı sıfırlanır. Qısa bir zəng kifayətdir! 🔥` }),
    streak_soft: (v) => ({ title: `🔥 ${v.streak} günlük streak-in gözləyir`, body: "Bu gün hələ danışmamısan — bir zəng et, alovu qoru!" }),
    teacher_invite: (v, f) => ({ title: "🎓 Müəllim dəvəti", body: `${v.teacherName || f.teacher} sizi şagird kimi əlavə etmək istəyir — baxın.` }),
    invite_accepted: (v, f) => ({ title: "✅ Şagird qoşuldu", body: `${v.studentName || f.student} dəvətinizi qəbul etdi.` }),
    tutor_verified: () => ({ title: "🎓 Tutor profiliniz təsdiqləndi", body: "Adınızın yanında Tutor nişanı artıq görünür." }),
    teacher_nudge: (v, f) => ({ title: `${v.teacherName || f.teacher} sizi gözləyir`, body: "Bugünkü danışıq praktikan hələ bitməyib — cəmi 8 dəqiqə çəkir." }),
    teacher_scheduled_call: (v, f) => ({ title: `🗓️ ${v.teacherName || f.teacher} zəng təyin etdi`, body: `${v.time} — ${v.peerName || f.peer} ilə. Vaxtında qoşulun!` }),
    slot_nearby: (v) => ({ title: "Yaxın vaxtda da adam var", body: `${v.time} blokunda bir nəfər gözləyir — ora da yazılsanız zəng dərhal təsdiqlənəcək.` }),
    slot_matched: (v, f) => ({ title: "✅ Zənginiz təsdiqləndi", body: `${v.time} — ${v.peerName || f.peer} ilə. Vaxtında qoşulun!` }),
    slot_matched_mentor: (v, f) => ({ title: "✅ Zənginiz təsdiqləndi", body: `${v.time} — ${v.peerName || f.peer} ilə. Partnyorunuz sizdən öyrənməyə həvəslidir; sizin axıcılığınız bugünkü söhbətdə ona böyük dəstək olacaq.` }),
    slot_released: (v) => ({ title: "Slotunuz yenidən açıldı", body: `Partnyorunuzun planı dəyişdi — ${v.time} slotunuz yenidən axtarışa açıldı.` }),
    slot_change_request: (v, f) => ({ title: "🕘 Vaxt dəyişikliyi təklifi", body: `${v.peerName || f.peer} zəngi ${v.time} vaxtına keçirmək istəyir.` }),
    slot_change_accepted: (v) => ({ title: "✅ Vaxt dəyişdirildi", body: `Zənginiz ${v.time} vaxtına keçirildi.` }),
    slot_change_declined: () => ({ title: "Vaxt dəyişikliyi baş tutmadı", body: "Partnyorunuz üçün bu vaxt uyğun deyil — köhnə vaxt qüvvədə qalır." }),
    slot_reminder: (v) => ({ title: "⏰ 10 dəqiqəyə praktika", body: `${v.time} — zənginiz başlamaq üzrədir.` }),
    slot_start: () => ({ title: "🎙️ Praktika vaxtıdır", body: "Partnyorunuz sizi gözləyir — tətbiqi açın." }),
    // Eşləşmədən sonra həmin günün qalan blokları buraxılır — bir gündə iki
    // yerdə gözlənilməyəsən deyə. Bunu bildirmək VACİBDİR: bloklar lövhədən
    // özbaşına yox olsaydı, istifadəçi seçiminin itdiyini düşünərdi.
    slot_day_cleared: (v) => ({ title: "Bugünkü digər bloklarınız boşaldıldı", body: `Zənginiz ${v.time} vaxtına təsdiqləndi, ona görə bugünkü qalan bloklarınız axtarışdan çıxarıldı. Sabahkı seçimləriniz olduğu kimi qalır.` }),
    slot_match_cancelled: (v, f) => ({ title: "Zənginiz ləğv edildi", body: `${v.byName || f.teacher} ${v.time} zəngini ləğv etdi. Blokda qalırsınız — yeni partnyor tapıla bilər.` }),
    slot_missed: (v) => ({ title: "🔕 Praktika keçmədi", body: `${v.time} zənginə heç kim qoşulmadı. Növbəti dəfə vaxtında qoşulmağa çalış!` }),
    session_reminder: (v) => ({ title: "Axşam sessiyasına az qaldı! 🌙", body: `Sessiya ${v.time}-da başlayır — günün mövzusuna bax və hazır ol.` }),
    search_ping: (v, f) => ({ title: "Kimsə praktika axtarır 🎙️", body: `${v.searcherName || f.someone} partnyor gözləyir — indi qoşul!` }),
    analysis_ready: () => ({ title: "Analiziniz hazırdır 🎓", body: "Zəng analizin hazır oldu — nəticəyə bax!" }),
    analysis_failed: (v) => ({ title: "Analiz alınmadı", body: v.noSpeech ? "Danışıq eşidilmədi — mikrofonu yoxlayıb yenidən cəhd et." : "Zəngin analizi tamamlana bilmədi. Növbəti zəngdə yenidən cəhd edəcəyik." }),
    student_analysis_ready: (v, f) => ({ title: "Şagird analizi hazırdır 🎓", body: `${v.studentName || f.student} yeni danışıq analizi hazırdır — paneldən baxın.` }),
    ai_report_ready: () => ({ title: "Hesabatın hazırdır", body: "AInur ilə sessiyanın necə keçdiyinə bax." }),
  },

  tr: {
    incoming_call: (v) => ({ title: `📞 ${v.callerName} sizi arıyor`, body: "Kabul etmek için uygulamayı açın" }),
    premium_activated: (v, f) => ({ title: "👑 Premium etkinleştirildi", body: `${v.userName || f.member}, tüm premium özellikler artık size açık!` }),
    daily_reminder: (v) => ({ title: `💬 ${v.topic}`, body: v.question ? `${v.question} — Cevabını düşün ve giriş yap!` : "Giriş yap ve bu konuda öğrendiklerini pratiğe dök!" }),
    streak_urgent: (v) => ({ title: "⚠️ Serin bu gece sönecek!", body: `${v.streak} günlük emeğin gece yarısı sıfırlanıyor. Kısa bir görüşme yeter! 🔥` }),
    streak_soft: (v) => ({ title: `🔥 ${v.streak} günlük serin seni bekliyor`, body: "Bugün henüz konuşmadın — bir görüşme yap, alevi koru!" }),
    teacher_invite: (v, f) => ({ title: "🎓 Öğretmen daveti", body: `${v.teacherName || f.teacher} sizi öğrenci olarak eklemek istiyor — göz atın.` }),
    invite_accepted: (v, f) => ({ title: "✅ Öğrenci katıldı", body: `${v.studentName || f.student} davetinizi kabul etti.` }),
    tutor_verified: () => ({ title: "🎓 Eğitmen profiliniz onaylandı", body: "Adınızın yanında Eğitmen rozeti artık görünüyor." }),
    teacher_nudge: (v, f) => ({ title: `${v.teacherName || f.teacher} sizi bekliyor`, body: "Bugünkü konuşma pratiğin henüz bitmedi — sadece 8 dakika sürüyor." }),
    teacher_scheduled_call: (v, f) => ({ title: `🗓️ ${v.teacherName || f.teacher} görüşme ayarladı`, body: `${v.time} — ${v.peerName || f.peer} ile. Zamanında katılın!` }),
    slot_nearby: (v) => ({ title: "Yakın bir saatte de biri var", body: `${v.time} bloğunda biri bekliyor — oraya da yazılırsanız görüşme hemen onaylanır.` }),
    slot_matched: (v, f) => ({ title: "✅ Görüşmeniz onaylandı", body: `${v.time} — ${v.peerName || f.peer} ile. Zamanında katılın!` }),
    slot_matched_mentor: (v, f) => ({ title: "✅ Görüşmeniz onaylandı", body: `${v.time} — ${v.peerName || f.peer} ile. Partneriniz sizden öğrenmeye istekli; akıcılığınız bugünkü sohbette ona büyük destek olacak.` }),
    slot_released: (v) => ({ title: "Saatiniz yeniden açıldı", body: `Partnerinizin planı değişti — ${v.time} saatiniz yeniden eşleşmeye açıldı.` }),
    slot_change_request: (v, f) => ({ title: "🕘 Saat değişikliği teklifi", body: `${v.peerName || f.peer} görüşmeyi ${v.time} saatine almak istiyor.` }),
    slot_change_accepted: (v) => ({ title: "✅ Saat değiştirildi", body: `Görüşmeniz ${v.time} saatine alındı.` }),
    slot_change_declined: () => ({ title: "Saat değişikliği olmadı", body: "Partneriniz için bu saat uygun değil — eski saat geçerli kalıyor." }),
    slot_reminder: (v) => ({ title: "⏰ Pratiğe 10 dakika", body: `${v.time} — görüşmeniz başlamak üzere.` }),
    slot_start: () => ({ title: "🎙️ Pratik zamanı", body: "Partneriniz sizi bekliyor — uygulamayı açın." }),
    slot_day_cleared: (v) => ({ title: "Bugünkü diğer bloklarınız boşaltıldı", body: `Görüşmeniz ${v.time} için onaylandı, bu yüzden bugünkü diğer bloklarınız eşleşmeden çıkarıldı. Yarınki seçimleriniz olduğu gibi kalıyor.` }),
    slot_match_cancelled: (v, f) => ({ title: "Görüşmeniz iptal edildi", body: `${v.byName || f.teacher} ${v.time} görüşmesini iptal etti. Blokta kalıyorsunuz — yeni bir partner bulunabilir.` }),
    slot_missed: (v) => ({ title: "🔕 Pratik gerçekleşmedi", body: `${v.time} görüşmesine kimse katılmadı. Bir dahaki sefere zamanında katılmayı dene!` }),
    session_reminder: (v) => ({ title: "Akşam seansına az kaldı! 🌙", body: `Seans ${v.time} itibarıyla başlıyor — günün konusuna bak ve hazır ol.` }),
    search_ping: (v, f) => ({ title: "Biri pratik arıyor 🎙️", body: `${v.searcherName || f.someone} partner bekliyor — hemen katıl!` }),
    analysis_ready: () => ({ title: "Analiziniz hazır 🎓", body: "Görüşme analizin hazır — sonuca göz at!" }),
    analysis_failed: (v) => ({ title: "Analiz alınamadı", body: v.noSpeech ? "Konuşma duyulmadı — mikrofonu kontrol edip tekrar dene." : "Görüşmenin analizi tamamlanamadı. Bir sonraki görüşmede tekrar deneyeceğiz." }),
    student_analysis_ready: (v, f) => ({ title: "Öğrenci analizi hazır 🎓", body: `${v.studentName || f.student} yeni konuşma analizi hazır — panelden inceleyin.` }),
    ai_report_ready: () => ({ title: "Raporun hazır", body: "AInur ile seansının nasıl geçtiğine bak." }),
  },

  en: {
    incoming_call: (v) => ({ title: `📞 ${v.callerName} is calling you`, body: "Open the app to answer" }),
    premium_activated: (v, f) => ({ title: "👑 Premium activated", body: `${v.userName || f.member}, every premium feature is open to you now!` }),
    daily_reminder: (v) => ({ title: `💬 ${v.topic}`, body: v.question ? `${v.question} — think of your answer and jump in!` : "Open the app and practise what you learned on this topic!" }),
    streak_urgent: (v) => ({ title: "⚠️ Your streak ends tonight!", body: `${v.streak} days of work reset at midnight. One short call is enough! 🔥` }),
    streak_soft: (v) => ({ title: `🔥 Your ${v.streak}-day streak is waiting`, body: "You haven't spoken today — make one call and keep the fire going!" }),
    teacher_invite: (v, f) => ({ title: "🎓 Teacher invitation", body: `${v.teacherName || f.teacher} wants to add you as a student — take a look.` }),
    invite_accepted: (v, f) => ({ title: "✅ Student joined", body: `${v.studentName || f.student} accepted your invitation.` }),
    tutor_verified: () => ({ title: "🎓 Your tutor profile is approved", body: "The Tutor badge now appears next to your name." }),
    teacher_nudge: (v, f) => ({ title: `${v.teacherName || f.teacher} is waiting for you`, body: "Today's speaking practice is not done yet — it takes about 8 minutes." }),
    teacher_scheduled_call: (v, f) => ({ title: `🗓️ ${v.teacherName || f.teacher} scheduled a call`, body: `${v.time} — with ${v.peerName || f.peer}. Be on time!` }),
    slot_nearby: (v) => ({ title: "Someone is free nearby", body: `Somebody is waiting in the ${v.time} block — add it too and your call is confirmed straight away.` }),
    slot_matched: (v, f) => ({ title: "✅ Your call is confirmed", body: `${v.time} — with ${v.peerName || f.peer}. Be on time!` }),
    slot_matched_mentor: (v, f) => ({ title: "✅ Your call is confirmed", body: `${v.time} — with ${v.peerName || f.peer}. Your partner is keen to learn from you; your fluency will carry today's conversation.` }),
    slot_released: (v) => ({ title: "Your slot is open again", body: `Your partner's plans changed — your ${v.time} slot is back in the pool.` }),
    slot_change_request: (v, f) => ({ title: "🕘 New time proposed", body: `${v.peerName || f.peer} wants to move the call to ${v.time}.` }),
    slot_change_accepted: (v) => ({ title: "✅ Time changed", body: `Your call moved to ${v.time}.` }),
    slot_change_declined: () => ({ title: "The time change didn't happen", body: "That time doesn't work for your partner — the original time stands." }),
    slot_reminder: (v) => ({ title: "⏰ Practice in 10 minutes", body: `${v.time} — your call is about to start.` }),
    slot_start: () => ({ title: "🎙️ Time to practise", body: "Your partner is waiting — open the app." }),
    slot_day_cleared: (v) => ({ title: "Your other blocks today were released", body: `Your call is confirmed for ${v.time}, so the rest of today's blocks were taken out of matching. Your choices for the other days are untouched.` }),
    slot_match_cancelled: (v, f) => ({ title: "Your call was cancelled", body: `${v.byName || f.teacher} cancelled the ${v.time} call. You are still in that block — a new partner can be found.` }),
    slot_missed: (v) => ({ title: "🔕 The practice didn't happen", body: `Nobody joined your call (${v.time}). Try to be there on time next round!` }),
    session_reminder: (v) => ({ title: "The evening session starts soon! 🌙", body: `The session starts at ${v.time} — check today's topic and get ready.` }),
    search_ping: (v, f) => ({ title: "Someone is looking for practice 🎙️", body: `${v.searcherName || f.someone} is waiting for a partner — join now!` }),
    analysis_ready: () => ({ title: "Your analysis is ready 🎓", body: "Your call analysis is done — go and see the result!" }),
    analysis_failed: (v) => ({ title: "The analysis failed", body: v.noSpeech ? "We heard no speech — check your microphone and try again." : "We could not finish the analysis of your call. We'll try again on your next one." }),
    student_analysis_ready: (v, f) => ({ title: "Student analysis is ready 🎓", body: `A new speaking analysis for ${v.studentName || f.student} is ready — review it in your panel.` }),
    ai_report_ready: () => ({ title: "Your report is ready", body: "See how your session with AInur went." }),
  },
};

// Resolve one notification. An unknown language or key degrades to Azerbaijani
// rather than throwing — a missing translation must never lose a push.
function pushText(lang, key, vars = {}) {
  const code = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
  const build = (STRINGS[code] || STRINGS[DEFAULT_LANG])[key] || STRINGS[DEFAULT_LANG][key];
  if (!build) {
    console.warn("[pushText] unknown key:", key);
    return { title: "SpeakLab", body: "" };
  }
  const f = FALLBACK[code] || FALLBACK[DEFAULT_LANG];
  // A dozen strings interpolate `time`. Filling it once here means a caller
  // that could not resolve a slot never renders "moved to undefined".
  return build({ ...vars, time: vars.time || f.time }, f);
}

module.exports = {
  pushText,
  pushLang,
  slotTimeLabel,
  hourOnlyLabel,
  SUPPORTED_PUSH_LANGS: SUPPORTED,
};

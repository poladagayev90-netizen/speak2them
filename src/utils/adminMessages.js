// Admin → Matching WhatsApp messages (2026-11-22).
// Pure helpers so every language (az/tr/ru/en) and local-timezone conversion is
// unit-tested. Never names a fear ("hazırsınız?", "qorxma") or an exam word
// ("yoxla", "imtahan") — only concrete times from the learner's own grid.

import { offsetVsBaku } from './timezone';
import { FIRST_RUN_LANGS } from './firstRunLang';

const DAY_NAMES = {
  az: ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'],
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const OR_WORD = { az: 'yoxsa', tr: 'yoksa', ru: 'или', en: 'or' };

const pickLang = (lang) => (FIRST_RUN_LANGS.includes(lang) ? lang : 'en');
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// Format a Baku slotId ("YYYY-MM-DD-HH") in the learner's own timezone and language.
export function formatSlotLocal(slotId, timeZone, lang = 'en') {
  const m = /^(\d{4}-\d{2}-\d{2})-(\d{2})$/.exec(String(slotId || ''));
  if (!m) return '';
  const l = pickLang(lang);
  const bakuDate = m[1];
  const bakuHour = Number(m[2]);
  const diffMin = timeZone && timeZone !== 'Asia/Baku' ? offsetVsBaku(timeZone) : 0;
  // Convert Baku wall-clock to UTC ms, then shift to target local wall-clock.
  const utcMs = Date.parse(`${bakuDate}T00:00:00Z`) + (bakuHour - 4) * 3600000;
  const localMs = utcMs + (4 * 60 + diffMin) * 60000;
  const d = new Date(localMs);
  const wd = DAY_NAMES[l][d.getUTCDay()];
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${wd} ${hh}:${mm}`;
}

// Pair two concrete slot options from the learner's own grid in their language.
export function formatTwoSlots(slots, timeZone, lang = 'en') {
  const l = pickLang(lang);
  const labels = (slots || [])
    .slice(0, 2)
    .map((s) => formatSlotLocal(typeof s === 'string' ? s : s?.slotId, timeZone, l))
    .filter(Boolean);
  if (!labels.length) return '';
  if (labels.length === 1) return labels[0];
  return `${labels[0]} ${OR_WORD[l]} ${labels[1]}`;
}

// Direct WhatsApp message from a PairRow card (matching console).
// Always in the learner's own language and local time; optional 2 concrete
// alternative times from their own grid when reminding/rescheduling.
export function matchNotifyMessage({
  kind = 'pending',
  lang = 'en',
  name = '',
  partnerName = '',
  slotId = '',
  timeZone = 'Asia/Baku',
  accepted = false,
  altSlots = [],
}) {
  const l = pickLang(lang);
  const me = firstName(name);
  const peer = firstName(partnerName);
  const when = formatSlotLocal(slotId, timeZone, l);
  const alts = formatTwoSlots(altSlots, timeZone, l);

  if (kind === 'booked') {
    const map = {
      az: () => `Salam${me ? `, ${me}` : ''}! ${when} üçün ${peer || 'tərəf-müqabilin'} ilə SpeakLab praktikan bərkidilib. 5 dəqiqə qalmış tətbiqdə Join düyməsi açılacaq.`,
      tr: () => `Merhaba${me ? ` ${me}` : ''}! ${when} için ${peer || 'partnerin'} ile SpeakLab pratiğin onaylandı. 5 dakika kala uygulamada Join butonu açılacak.`,
      ru: () => `Привет${me ? `, ${me}` : ''}! Твоя практика в SpeakLab с ${peer || 'партнёром'} назначена на ${when}. За 5 минут до начала в приложении откроется кнопка Join.`,
      en: () => `Hi${me ? ` ${me}` : ''}! Your SpeakLab practice with ${peer || 'your partner'} is booked for ${when}. The Join button opens in the app 5 minutes before.`,
    };
    return map[l]();
  }

  if (kind === 'pending' && !accepted) {
    const altLine = {
      az: alts ? ` Bu vaxt alınmasa, cədvəlindən ${alts} uyğundurmu?` : '',
      tr: alts ? ` Bu saat uymazsa programından ${alts} uygun mu?` : '',
      ru: alts ? ` Если не подходит, подойдёт ${alts}?` : '',
      en: alts ? ` If not, would ${alts} work instead?` : '',
    };
    const map = {
      az: () => `Salam${me ? `, ${me}` : ''}! SpeakLab-da ${when} üçün ${peer || 'uyğun tərəf-müqabil'} ilə praktika təklifi göndərilib — tətbiqdə təsdiqləsən yerin bərkidilər.${altLine.az}`,
      tr: () => `Merhaba${me ? ` ${me}` : ''}! SpeakLab'de ${when} için ${peer || 'uygun bir partner'} ile pratik önerisi gönderildi — uygulamada onaylarsan yerin kesinleşir.${altLine.tr}`,
      ru: () => `Привет${me ? `, ${me}` : ''}! В SpeakLab тебя ждёт предложение на практику ${when} с ${peer || 'партнёром'} — подтверди в приложении, чтобы закрепить время.${altLine.ru}`,
      en: () => `Hi${me ? ` ${me}` : ''}! A SpeakLab practice with ${peer || 'a partner'} is waiting for your confirmation for ${when} — tap Yes in the app to lock it in.${altLine.en}`,
    };
    return map[l]();
  }

  // Accepted pending (waiting on the other side) or expired/declined follow-up.
  const altLine = {
    az: alts ? ` Cədvəlindən ${alts} — hansını bağlayaq?` : ' Tətbiqdə Plan bölməsindən yeni saat seçə bilərsən.',
    tr: alts ? ` Programından ${alts} — hangisini ayarlayalım?` : ' Uygulamadaki Plan sekmesinden yeni bir saat seçebilirsin.',
    ru: alts ? ` Из твоего расписания: ${alts} — какое время закрепим?` : ' Выбери удобное время во вкладке Plan в приложении.',
    en: alts ? ` From your schedule: ${alts} — which one shall we lock in?` : ' Pick another time in the Plan tab whenever suits you.',
  };
  const map = {
    az: () => `Salam${me ? `, ${me}` : ''}! ${when} üçün praktikanı yeniləyək.${altLine.az}`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! ${when} pratiğini yeniden ayarlayalım.${altLine.tr}`,
    ru: () => `Привет${me ? `, ${me}` : ''}! Давай подберём время вместо ${when}.${altLine.ru}`,
    en: () => `Hi${me ? ` ${me}` : ''}! Let's set a fresh time instead of ${when}.${altLine.en}`,
  };
  return map[l]();
}

// Invite an active / trusted partner (even when not "in" this week, e.g. Sabina/Rumeysa/Yunus).
export function inviteRegularMessage({
  lang = 'en',
  name = '',
  targetName = '',
  targetLevel = '',
  slots = [],
  timeZone = 'Asia/Baku',
}) {
  const l = pickLang(lang);
  const me = firstName(name);
  const target = firstName(targetName);
  const lvl = targetLevel ? ` (${targetLevel})` : '';
  const choice = formatTwoSlots(slots, timeZone, l);
  const map = {
    az: () => `Salam${me ? `, ${me}` : ''}! Mən Polad, SpeakLab-dan. Bu həftə ${target || 'yeni iştirakçı'}${lvl} ilə 15 dəqiqəlik praktika etmək istəyərsən?${choice ? ` ${choice} — hansı rahatdır?` : ' Hansı saat sənə rahat olar?'}`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! Ben Polad, SpeakLab'den. Bu hafta ${target || 'yeni bir üyemiz'}${lvl} ile 15 dakikalık pratik yapmak ister misin?${choice ? ` ${choice} — hangisi uygun?` : ' Hangi saat sana uyar?'}`,
    ru: () => `Привет${me ? `, ${me}` : ''}! Я Полад из SpeakLab. Сможешь провести 15-минутную практику на этой неделе с ${target || 'новым участником'}${lvl}?${choice ? ` ${choice} — что удобнее?` : ' Какое время подойдёт?'}`,
    en: () => `Hi${me ? ` ${me}` : ''}! Polad from SpeakLab here. Could you join a 15-min practice this week with ${target || 'a learner'}${lvl}?${choice ? ` ${choice} — which works for you?` : ' What time suits you?'}`,
  };
  return map[l]();
}

// Newcomer welcome message using 2 concrete slots from their own onboarding grid.
export function newcomerGridMessage({ lang = 'en', name = '', slots = [], timeZone = 'Asia/Baku', practised = false }) {
  const l = pickLang(lang);
  const me = firstName(name);
  const choice = formatTwoSlots(slots, timeZone, l);
  if (practised) {
    const after = {
      az: () => `Salam${me ? `, ${me}` : ''}! Mən Polad, SpeakLab-dan. İlk məşqin necə keçdi?${choice ? ` Növbəti üçün ${choice} — hansını bağlayaq?` : ' Növbətini nə vaxt edək?'}`,
      tr: () => `Merhaba${me ? ` ${me}` : ''}! Ben Polad, SpeakLab'den. İlk pratiğin nasıl geçti?${choice ? ` Bir sonraki için ${choice} — hangisini ayarlayalım?` : ' Bir sonrakini ne zaman yapalım?'}`,
      ru: () => `Привет${me ? `, ${me}` : ''}! Я Полад из SpeakLab. Как прошла твоя первая практика?${choice ? ` Для следующей подойдёт ${choice}?` : ' Когда сделаем следующую?'}`,
      en: () => `Hi${me ? ` ${me}` : ''}! I'm Polad from SpeakLab. How was your first practice?${choice ? ` For the next one, ${choice} — which suits you?` : ' When shall we do the next one?'}`,
    };
    return after[l]();
  }
  const first = {
    az: () => `Salam${me ? `, ${me}` : ''}! Mən Polad, SpeakLab-dan. İlk 10 dəqiqəlik söhbətini səviyyənə uyğun sadə suallarla birlikdə başladaq.${choice ? ` Cədvəlindən ${choice} — hansı rahatdır?` : ' Bu həftə hansı gün və saat sənə rahatdır?'}`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! Ben Polad, SpeakLab'den. İlk 10 dakikalık pratiğini seviyene uygun basit sorularla birlikte başlatalım.${choice ? ` Programından ${choice} — hangisi uygun?` : ' Bu hafta hangi gün ve saat sana uygun?'}`,
    ru: () => `Привет${me ? `, ${me}` : ''}! Я Полад из SpeakLab. Давай начнём твою первую 10-минутную практику на твоём уровне с простыми вопросами.${choice ? ` Из твоего расписания: ${choice} — что удобнее?` : ' Какой день и время на этой неделе тебе удобны?'}`,
    en: () => `Hi${me ? ` ${me}` : ''}! I'm Polad from SpeakLab. Let's start your first 10-minute practice at your level with simple questions.${choice ? ` From your schedule: ${choice} — which works better?` : ' Which day and time suit you this week?'}`,
  };
  return first[l]();
}

export function waHref(number, text) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

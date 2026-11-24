// Admin → Matching WhatsApp & IG DM messages (2026-11-22; outreach v2 2026-11-24).
// Pure helpers so every language (az/tr/ru/en), timezone conversion, and trust
// signal is unit-tested.
// Rules:
// - Formal «Siz / Вы» address across all languages.
// - Never names a fear ("hazır?", "qorxma", "ready?") or exam word ("yoxla", "imtahan").
// - Call notifications ask only whether the scheduled/proposed time works (no alt hours).
// - Partner-confirmed wording ONLY appears when `partnerAccepted === true` from Firestore.

import { offsetVsBaku } from './timezone';
import { FIRST_RUN_LANGS } from './firstRunLang';
import { ACADEMY_CHAPTERS, academyChapterUrl } from './academyLink';

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

// Template (a): Direct match/booking notification from a real Firestore pair.
// Polite «Siz / Вы», shows partner's CEFR level when known (`partnerLevel` non-null),
// explicitly notes confirmation ONLY when `partnerAccepted === true`, and never
// suggests alternative hours.
export function matchNotifyMessage({
  kind = 'pending',
  lang = 'en',
  name = '',
  partnerName = '',
  partnerLevel = '',
  partnerAccepted = false,
  slotId = '',
  timeZone = 'Asia/Baku',
  accepted = false,
}) {
  const l = pickLang(lang);
  const me = firstName(name);
  const peer = firstName(partnerName);
  const lvl = partnerLevel ? ` (${partnerLevel})` : '';
  const when = formatSlotLocal(slotId, timeZone, l);

  if (kind === 'booked') {
    const map = {
      az: () => `Salam${me ? `, ${me}` : ''}! ${when} üçün ${peer || 'tərəf-müqabiliniz'}${lvl} ilə SpeakLab praktikanız planlaşdırılıb. Bu saat sizin üçün uyğundurmu? (5 dəqiqə qalmış tətbiqdə Join düyməsi açılacaq.)`,
      tr: () => `Merhaba${me ? ` ${me}` : ''}! ${when} için ${peer || 'partneriniz'}${lvl} ile SpeakLab pratiğiniz planlandı. Bu saat sizin için uygun mu? (5 dakika kala uygulamada Join butonu açılacak.)`,
      ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Ваша практика в SpeakLab на ${when} с ${peer || 'партнёром'}${lvl} запланирована. Это время вам подходит? (За 5 минут до начала в приложении откроется кнопка Join.)`,
      en: () => `Hi${me ? ` ${me}` : ''}! Your SpeakLab practice with ${peer || 'your partner'}${lvl} is scheduled for ${when}. Does this time work for you? (The Join button opens in the app 5 minutes before.)`,
    };
    return map[l]();
  }

  if (kind === 'pending' && !accepted) {
    if (partnerAccepted && peer) {
      const confirmedMap = {
        az: () => `Salam${me ? `, ${me}` : ''}! ${peer}${lvl} ${when} üçün sizinlə praktikanı artıq təsdiqləyib — siz də tətbiqdə təsdiqləsəniz yeriniz bərkidiləcək. Bu saat sizin üçün uyğundurmu?`,
        tr: () => `Merhaba${me ? ` ${me}` : ''}! ${peer}${lvl} ${when} için sizinle pratiği şimdiden onayladı — siz de uygulamada onaylarsanız yeriniz kesinleşecektir. Bu saat sizin için uygun mu?`,
        ru: () => `Здравствуйте${me ? `, ${me}` : ''}! ${peer}${lvl} уже подтвердил(а) практику с вами на ${when} — подтвердите в приложении, чтобы закрепить время. Это время вам подходит?`,
        en: () => `Hi${me ? ` ${me}` : ''}! ${peer}${lvl} already confirmed a SpeakLab practice with you for ${when} — confirm in the app to lock it in. Does this time work for you?`,
      };
      return confirmedMap[l]();
    }

    const map = {
      az: () => `Salam${me ? `, ${me}` : ''}! SpeakLab-da ${when} üçün ${peer || 'uyğun tərəf-müqabil'}${lvl} ilə praktika təklifi göndərilib — tətbiqdə təsdiqləsəniz yeriniz bərkidiləcək. Bu saat sizin üçün uyğundurmu?`,
      tr: () => `Merhaba${me ? ` ${me}` : ''}! SpeakLab'de ${when} için ${peer || 'uygun bir partner'}${lvl} ile pratik önerisi gönderildi — uygulamada onaylarsanız yeriniz kesinleşecektir. Bu saat sizin için uygun mu?`,
      ru: () => `Здравствуйте${me ? `, ${me}` : ''}! В SpeakLab вам отправлено предложение на практику ${when} с ${peer || 'партнёром'}${lvl} — подтвердите в приложении, чтобы закрепить время. Это время вам подходит?`,
      en: () => `Hi${me ? ` ${me}` : ''}! A SpeakLab practice proposal with ${peer || 'a partner'}${lvl} was sent for ${when} — please confirm in the app to lock it in. Does this time work for you?`,
    };
    return map[l]();
  }

  // Accepted pending (waiting on the other side) or expired/declined follow-up.
  const map = {
    az: () => `Salam${me ? `, ${me}` : ''}! ${when} üçün olan praktika ilə bağlı yazırıq — bu saat sizin üçün uyğundurmu?`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! ${when} pratiği için yazıyoruz — bu saat sizin için uygun mu?`,
    ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Пишем по поводу практики на ${when} — это время вам подходит?`,
    en: () => `Hi${me ? ` ${me}` : ''}! Following up on your ${when} practice — does this time work for you?`,
  };
  return map[l]();
}

// Template (b): Zero-pressure soft pause check for silent users. Polite «Siz / Вы»,
// never uses fear/pressure words («hazır», «ready», «qorxma», «imtahan»).
export function softPauseCheckMessage({ lang = 'en', name = '' } = {}) {
  const l = pickLang(lang);
  const me = firstName(name);
  const map = {
    az: () => `Salam${me ? `, ${me}` : ''}! SpeakLab praktikalarında iştirak etmək istəyirsiniz? Bu həftə vaxtınız yoxdursa, sizin üçün zəng təyin olunmasını müvəqqəti dayandıra bilərik — istədiyiniz vaxt yenidən aktivləşdirmək mümkündür.`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! SpeakLab pratiklerine katılmak ister misiniz? Bu hafta vaktiniz yoksa sizin için görüşme planlamasını geçici olarak durdurabiliriz — istediğiniz zaman yeniden başlatabilirsiniz.`,
    ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Хотите участвовать в практиках SpeakLab? Если на этой неделе нет времени, мы можем временно приостановить подбор звонков для вас — возобновить можно в любой момент.`,
    en: () => `Hi${me ? ` ${me}` : ''}! Would you like to join SpeakLab practices? If this week does not suit you, we can pause call scheduling for you anytime — just let us know when you want to resume.`,
  };
  return map[l]();
}

// Template (c): Shareable SpeakLab Academy chapter guide (public speaklab.me URL).
export function academyGuideMessage({ lang = 'en', name = '', chapterKey = 'install' } = {}) {
  const l = pickLang(lang);
  const me = firstName(name);
  const target = ACADEMY_CHAPTERS[chapterKey] || ACADEMY_CHAPTERS.install;
  const url = academyChapterUrl(target.course, target.chapter, l);
  const map = {
    az: () => `Salam${me ? `, ${me}` : ''}! SpeakLab-dan rahat istifadə etmək üçün qısa video bələdçiyə buradan baxa bilərsiniz: ${url}`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! SpeakLab'i kolayca kullanmak için kısa video rehberimizi buradan izleyebilirsiniz: ${url}`,
    ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Посмотреть короткую видеоинструкцию по SpeakLab можно здесь: ${url}`,
    en: () => `Hi${me ? ` ${me}` : ''}! You can watch our short video guide to SpeakLab here: ${url}`,
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
    az: () => `Salam${me ? `, ${me}` : ''}! Mən Polad, SpeakLab-dan. Bu həftə ${target || 'yeni iştirakçı'}${lvl} ilə 15 dəqiqəlik praktika etmək istəyərsiniz?${choice ? ` ${choice} — hansı sizə uyğundur?` : ' Hansı saat sizə uyğun olar?'}`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! Ben Polad, SpeakLab'den. Bu hafta ${target || 'yeni bir üyemiz'}${lvl} ile 15 dakikalık pratik yapmak ister misiniz?${choice ? ` ${choice} — hangisi sizin için uygun?` : ' Hangi saat size uygun olur?'}`,
    ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Я Полад из SpeakLab. Сможете провести 15-минутную практику на этой неделе с ${target || 'новым участником'}${lvl}?${choice ? ` ${choice} — что вам удобнее?` : ' Какое время вам подойдёт?'}`,
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
      az: () => `Salam${me ? `, ${me}` : ''}! Mən Polad, SpeakLab-dan. İlk məşqiniz necə keçdi?${choice ? ` Növbəti üçün ${choice} — hansı uyğundur?` : ' Növbətini nə vaxt edək?'}`,
      tr: () => `Merhaba${me ? ` ${me}` : ''}! Ben Polad, SpeakLab'den. İlk pratiğiniz nasıl geçti?${choice ? ` Bir sonraki için ${choice} — hangisi uygun?` : ' Bir sonrakini ne zaman yapalım?'}`,
      ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Я Полад из SpeakLab. Как прошла ваша первая практика?${choice ? ` Для следующей подойдёт ${choice}?` : ' Когда сделаем следующую?'}`,
      en: () => `Hi${me ? ` ${me}` : ''}! I'm Polad from SpeakLab. How was your first practice?${choice ? ` For the next one, ${choice} — which suits you?` : ' When shall we do the next one?'}`,
    };
    return after[l]();
  }
  const first = {
    az: () => `Salam${me ? `, ${me}` : ''}! Mən Polad, SpeakLab-dan. İlk 10 dəqiqəlik söhbətinizi səviyyənizə uyğun sadə suallarla birlikdə başladaq.${choice ? ` Cədvəlinizdən ${choice} — hansı uyğundur?` : ' Bu həftə hansı gün və saat sizə uyğundur?'}`,
    tr: () => `Merhaba${me ? ` ${me}` : ''}! Ben Polad, SpeakLab'den. İlk 10 dakikalık pratiğinizi seviyenize uygun basit sorularla birlikte başlatalım.${choice ? ` Programınızdan ${choice} — hangisi uygun?` : ' Bu hafta hangi gün ve saat size uygun?'}`,
    ru: () => `Здравствуйте${me ? `, ${me}` : ''}! Я Полад из SpeakLab. Давайте начнём вашу первую 10-минутную практику на вашем уровне с простыми вопросами.${choice ? ` Из вашего расписания: ${choice} — что удобнее?` : ' Какой день и время на этой неделе вам удобны?'}`,
    en: () => `Hi${me ? ` ${me}` : ''}! I'm Polad from SpeakLab. Let's start your first 10-minute practice at your level with simple questions.${choice ? ` From your schedule: ${choice} — which works better?` : ' Which day and time suit you this week?'}`,
  };
  return first[l]();
}

export function waHref(number, text) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

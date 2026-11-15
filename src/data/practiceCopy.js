// The PRACTICE PATH in the learner's language — the Today cards that tell an
// A1–A2 learner what happens next (Polad 2026-11-15: weak learners misread the
// English plan card and the week card). Only these cards: the plan card, the
// «usual week» card and the daily topic card's chrome. Topic titles and
// questions stay English — they are the lesson. Not an i18n system: one table,
// the same pattern as firstRunCopy.js, English as the fallback for any key.
//
// The language is the first-run one (useFirstRunCopy: the register pick, then
// users.guideLanguage, then the device); Profile → App language changes it.
//
// Copy rules: never name an hour (there is no session time), never name a
// fear — say what the product gives. Values are strings with {vars} or, where
// a number changes the words, a function of vars.

const ruPlural = (n, one, few, many) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};

const en = {
  'day.0': 'Sun', 'day.1': 'Mon', 'day.2': 'Tue', 'day.3': 'Wed', 'day.4': 'Thu', 'day.5': 'Fri', 'day.6': 'Sat',
  today: 'Today',
  tomorrow: 'Tomorrow',
  'count.now': 'Now',
  'count.dh': 'in {d}d {h}h',
  'count.hm': 'in {h}h {m}m',
  'count.m': 'in {m}m',

  'next.kicker': 'Your next practice',
  'next.kickerLive': 'Practice time',
  'next.with': 'with',
  'next.join': 'Join the call',
  'next.message': 'Message',
  'next.myWeek': 'My week',
  'next.joinHint': 'The Join button appears here five minutes before the start.',

  'answer.title': ({ n }) => `${n} ${n === 1 ? 'practice needs' : 'practices need'} your answer`,
  'answer.text': 'Each one is booked once you and your partner both say yes.',
  'answer.action': 'Review',
  'setup.title': 'Set up your practice plan',
  'setup.text': 'Tell us when you are free and how many practices a week you want. Every Sunday evening you get a plan with real partners.',
  'setup.action': 'Set up my plan',
  'paused.title': 'Your plan is paused',
  'paused.text': 'No new practices are planned for you until you switch it back on.',
  'paused.action': 'Resume my plan',
  'paused.busy': 'Resuming…',
  'done.title': 'Weekly goal reached',
  'done.text': '{a} of {t} practices done. Anything more this week is a bonus.',
  'done.action': 'Message a partner',
  'noMatch.title': 'No partner at your times yet',
  'noMatch.action': 'Edit my free times',
  'noMatch.no_times': 'You have no free times saved for this week. Add a few and the next plan can include you.',
  'noMatch.no_overlap': 'Nobody who fits you is free at the same hours yet. More free times give the plan more to work with.',
  'noMatch.no_partner_left': 'Everyone free at your hours already had a full week. You are first in line for the next plan.',
  'noMatch.replacement_not_found': 'Your partner could not make it, and no other time has turned up this week yet. Your free times stay open for the next one.',
  'noMatch.added': 'Added — we are looking again',
  'noMatch.addedText': '{label} is now one of your free times.',
  'noMatch.popular': 'Many people practise {label}. Add it and the plan has more to work with.',
  'noMatch.add': 'Add {label}',
  'noMatch.adding': 'Adding…',
  'looking.title': 'Looking for partners · {days}',
  'looking.titleWeek': 'Looking for partners this week',
  'looking.text': 'When someone fits your times, a practice comes here to confirm.',
  'waiting.title': 'Your next plan arrives on Sunday evening',
  'waiting.text': 'You will get your practices for the week to confirm.',
  sooner: 'Want to talk sooner? Message someone you have practised with.',
  partners: 'Partners',
  'free.title': 'Your free practices are used',
  'free.text': 'AInur and calls with friends stay free.',
  'packages.none': 'No planned practices left.',
  'packages.see': 'See packages',
  'limit.title': 'One practice a week for now',
  'limit.text': ({ missed, left, usual }) => `${missed} confirmed ${missed === 1 ? 'practice was' : 'practices were'} missed in the last 4 weeks. `
    + `Attend your next ${left === 1 ? 'practice' : `${left} practices`} and your plan goes back to ${usual} a week.`,

  'checkin.title': 'Next week on your usual times',
  'checkin.text': ({ days, n }) => `${days} · ${n} ${n === 1 ? 'practice' : 'practices'}, each with a real partner. Your plan comes on Sunday evening.`,
  'checkin.change': 'Change hours',
  'checkin.off': 'Take the week off',
  saving: 'Saving…',
  saveError: 'Could not save. Check your connection.',

  'week.title': 'Tell us your usual week',
  'week.text': 'Mark the hours you are free, maybe free and never free. General info so we can plan better — we never book a call without your yes.',
  'week.open': 'Open my week',
  'week.later': 'Later',

  'topic.kicker': 'Today’s practice topic',
  'topic.day': 'Day {day}',
  'topic.fallback': 'Today’s topic',
  'topic.ctaFull': 'Listen, read, words and questions',
  'topic.ctaShort': 'Words, idioms and questions',
};

const az = {
  // Full names: the short forms (B.e., Ç.a.) are not something an A1 learner
  // reads at a glance.
  'day.0': 'Bazar', 'day.1': 'Bazar ertəsi', 'day.2': 'Çərşənbə axşamı', 'day.3': 'Çərşənbə',
  'day.4': 'Cümə axşamı', 'day.5': 'Cümə', 'day.6': 'Şənbə',
  today: 'Bu gün',
  tomorrow: 'Sabah',
  'count.now': 'İndi',
  'count.dh': '{d} gün {h} saata',
  'count.hm': '{h} saat {m} dəqiqəyə',
  'count.m': '{m} dəqiqəyə',

  'next.kicker': 'Növbəti məşqin',
  'next.kickerLive': 'Məşq vaxtıdır',
  'next.with': 'partnyor:',
  'next.join': 'Zəngə qoşul',
  'next.message': 'Yaz',
  'next.myWeek': 'Həftəm',
  'next.joinHint': '«Qoşul» düyməsi başlamağa beş dəqiqə qalmış burada görünəcək.',

  'answer.title': ({ n }) => `${n} məşq cavabını gözləyir`,
  'answer.text': 'Sən və partnyorun «hə» deyəndə məşq bron olunur.',
  'answer.action': 'Bax',
  'setup.title': 'Məşq planını qur',
  'setup.text': 'Nə vaxt boş olduğunu və həftədə neçə məşq istədiyini de. Hər bazar axşamı real partnyorlarla planın gəlir.',
  'setup.action': 'Planımı qur',
  'paused.title': 'Planın dayandırılıb',
  'paused.text': 'Planı yenidən açana qədər sənə yeni məşq planlanmır.',
  'paused.action': 'Planı davam etdir',
  'paused.busy': 'Açılır…',
  'done.title': 'Həftəlik hədəfə çatdın',
  'done.text': 'Edilən məşqlər: {a} / {t}. Bu həftə bundan artığı bonusdur.',
  'done.action': 'Partnyora yaz',
  'noMatch.title': 'Saatlarına uyğun partnyor hələ yoxdur',
  'noMatch.action': 'Boş saatlarımı dəyiş',
  'noMatch.no_times': 'Bu həftə üçün boş saatın yoxdur. Bir neçəsini əlavə et, növbəti plana düşəsən.',
  'noMatch.no_overlap': 'Sənə uyğun olan heç kim hələ eyni saatlarda boş deyil. Nə qədər çox boş saat, plan üçün o qədər çox imkan.',
  'noMatch.no_partner_left': 'Sənin saatlarında boş olan hər kəsin həftəsi artıq doludur. Növbəti planda ilk sıradasan.',
  'noMatch.replacement_not_found': 'Partnyorun gələ bilmədi, bu həftə başqa vaxt da hələ tapılmadı. Boş saatların növbəti plan üçün açıq qalır.',
  'noMatch.added': 'Əlavə olundu — yenidən axtarırıq',
  'noMatch.addedText': '{label} indi boş saatlarından biridir.',
  'noMatch.popular': 'Çox adam {label} məşq edir. Onu əlavə et — plan üçün daha çox imkan olar.',
  'noMatch.add': '{label} əlavə et',
  'noMatch.adding': 'Əlavə olunur…',
  'looking.title': 'Partnyor axtarırıq · {days}',
  'looking.titleWeek': 'Bu həftə üçün partnyor axtarırıq',
  'looking.text': 'Saatlarına uyğun biri tapılanda məşq təsdiq üçün bura gələcək.',
  'waiting.title': 'Növbəti planın bazar axşamı gəlir',
  'waiting.text': 'Həftənin məşqləri təsdiq üçün sənə gələcək.',
  sooner: 'Daha tez danışmaq istəyirsən? Əvvəl məşq etdiyin birinə yaz.',
  partners: 'Partnyorlar',
  'free.title': 'Pulsuz məşqlərin bitdi',
  'free.text': 'AInur və dostlarla zənglər pulsuz qalır.',
  'packages.none': 'Planlı məşqin qalmayıb.',
  'packages.see': 'Paketlərə bax',
  'limit.title': 'Hələlik həftədə bir məşq',
  'limit.text': ({ missed, left, usual }) => `Son 4 həftədə təsdiqlənmiş ${missed} məşq buraxılıb. `
    + `Növbəti ${left === 1 ? 'məşqinə' : `${left} məşqinə`} gəl — planın yenidən həftədə ${usual} olacaq.`,

  'checkin.title': 'Gələn həftə — adi saatlarında',
  'checkin.text': ({ days, n }) => `${days} · ${n} məşq, hər biri real partnyorla. Planın bazar axşamı gəlir.`,
  'checkin.change': 'Saatları dəyiş',
  'checkin.off': 'Həftəyə ara ver',
  saving: 'Yadda saxlanılır…',
  saveError: 'Yadda saxlamaq olmadı. İnterneti yoxla.',

  'week.title': 'Adi həftəni bizə de',
  'week.text': 'Saatları işarələ: «Boş», «Bəlkə» və «Heç vaxt». Bu, planı daha yaxşı qurmaq üçün ümumi məlumatdır — sənin «hə»n olmadan heç bir zəng bron olunmur.',
  'week.open': 'Həftəmi aç',
  'week.later': 'Sonra',

  'topic.kicker': 'Günün məşq mövzusu',
  'topic.day': 'Gün {day}',
  'topic.fallback': 'Günün mövzusu',
  'topic.ctaFull': 'Dinlə, oxu, sözlər və suallar',
  'topic.ctaShort': 'Sözlər, idiomlar və suallar',
};

const tr = {
  'day.0': 'Paz', 'day.1': 'Pzt', 'day.2': 'Sal', 'day.3': 'Çar', 'day.4': 'Per', 'day.5': 'Cum', 'day.6': 'Cmt',
  today: 'Bugün',
  tomorrow: 'Yarın',
  'count.now': 'Şimdi',
  'count.dh': '{d} gün {h} saat sonra',
  'count.hm': '{h} saat {m} dk sonra',
  'count.m': '{m} dk sonra',

  'next.kicker': 'Sıradaki pratiğin',
  'next.kickerLive': 'Pratik zamanı',
  'next.with': 'partnerin:',
  'next.join': 'Görüşmeye katıl',
  'next.message': 'Mesaj',
  'next.myWeek': 'Haftam',
  'next.joinHint': '«Katıl» düğmesi başlamadan beş dakika önce burada çıkar.',

  'answer.title': ({ n }) => `${n} pratik cevabını bekliyor`,
  'answer.text': 'Sen ve partnerin «evet» deyince pratik ayrılır.',
  'answer.action': 'İncele',
  'setup.title': 'Pratik planını kur',
  'setup.text': 'Ne zaman boş olduğunu ve haftada kaç pratik istediğini söyle. Her pazar akşamı gerçek partnerlerle planın gelir.',
  'setup.action': 'Planımı kur',
  'paused.title': 'Planın durduruldu',
  'paused.text': 'Planı tekrar açana kadar sana yeni pratik planlanmaz.',
  'paused.action': 'Planıma devam et',
  'paused.busy': 'Açılıyor…',
  'done.title': 'Haftalık hedefe ulaştın',
  'done.text': '{t} pratikten {a} tanesi tamam. Bu hafta fazlası bonus.',
  'done.action': 'Partnere yaz',
  'noMatch.title': 'Saatlerine uygun partner henüz yok',
  'noMatch.action': 'Boş saatlerimi değiştir',
  'noMatch.no_times': 'Bu hafta için kayıtlı boş saatin yok. Birkaç tane ekle, bir sonraki plana gir.',
  'noMatch.no_overlap': 'Sana uyan kimse henüz aynı saatlerde boş değil. Ne kadar çok boş saat, plan için o kadar çok seçenek.',
  'noMatch.no_partner_left': 'Senin saatlerinde boş olan herkesin haftası zaten dolu. Bir sonraki planda ilk sıradasın.',
  'noMatch.replacement_not_found': 'Partnerin gelemedi, bu hafta başka bir saat de henüz çıkmadı. Boş saatlerin bir sonraki plan için açık kalıyor.',
  'noMatch.added': 'Eklendi — yeniden arıyoruz',
  'noMatch.addedText': '{label} artık boş saatlerinden biri.',
  'noMatch.popular': 'Birçok kişi {label} pratik yapıyor. Ekle, plan için daha çok seçenek olsun.',
  'noMatch.add': '{label} ekle',
  'noMatch.adding': 'Ekleniyor…',
  'looking.title': 'Partner arıyoruz · {days}',
  'looking.titleWeek': 'Bu hafta için partner arıyoruz',
  'looking.text': 'Saatlerine uyan biri çıkınca pratik onay için buraya gelir.',
  'waiting.title': 'Bir sonraki planın pazar akşamı geliyor',
  'waiting.text': 'Haftanın pratikleri onay için sana gelecek.',
  sooner: 'Daha erken konuşmak mı istiyorsun? Daha önce pratik yaptığın birine yaz.',
  partners: 'Partnerler',
  'free.title': 'Ücretsiz pratiklerin bitti',
  'free.text': 'AInur ve arkadaşlarla görüşmeler ücretsiz kalıyor.',
  'packages.none': 'Planlı pratiğin kalmadı.',
  'packages.see': 'Paketlere bak',
  'limit.title': 'Şimdilik haftada bir pratik',
  'limit.text': ({ missed, left, usual }) => `Son 4 haftada onaylanmış ${missed} pratik kaçırıldı. `
    + `Sıradaki ${left === 1 ? 'pratiğine' : `${left} pratiğine`} katıl — planın yeniden haftada ${usual} olur.`,

  'checkin.title': 'Gelecek hafta — her zamanki saatlerinde',
  'checkin.text': ({ days, n }) => `${days} · ${n} pratik, her biri gerçek bir partnerle. Planın pazar akşamı gelir.`,
  'checkin.change': 'Saatleri değiştir',
  'checkin.off': 'Haftaya ara ver',
  saving: 'Kaydediliyor…',
  saveError: 'Kaydedilemedi. İnternetini kontrol et.',

  'week.title': 'Normal haftanı bize anlat',
  'week.text': 'Saatleri işaretle: «Boş», «Belki» ve «Asla». Planı daha iyi kurmak için genel bir bilgi — senin «evet»in olmadan hiçbir görüşme ayarlanmaz.',
  'week.open': 'Haftamı aç',
  'week.later': 'Sonra',

  'topic.kicker': 'Günün pratik konusu',
  'topic.day': '{day}. gün',
  'topic.fallback': 'Günün konusu',
  'topic.ctaFull': 'Dinle, oku, kelimeler ve sorular',
  'topic.ctaShort': 'Kelimeler, deyimler ve sorular',
};

const ru = {
  'day.0': 'Вс', 'day.1': 'Пн', 'day.2': 'Вт', 'day.3': 'Ср', 'day.4': 'Чт', 'day.5': 'Пт', 'day.6': 'Сб',
  today: 'Сегодня',
  tomorrow: 'Завтра',
  'count.now': 'Сейчас',
  'count.dh': 'через {d} д {h} ч',
  'count.hm': 'через {h} ч {m} мин',
  'count.m': 'через {m} мин',

  'next.kicker': 'Твоя следующая практика',
  'next.kickerLive': 'Время практики',
  'next.with': 'партнёр:',
  'next.join': 'Войти в звонок',
  'next.message': 'Написать',
  'next.myWeek': 'Моя неделя',
  'next.joinHint': 'Кнопка входа появится здесь за пять минут до начала.',

  'answer.title': ({ n }) => `${n} ${ruPlural(n, 'практика ждёт', 'практики ждут', 'практик ждут')} твоего ответа`,
  'answer.text': 'Практика закреплена, когда и ты, и партнёр скажете «да».',
  'answer.action': 'Посмотреть',
  'setup.title': 'Настрой план практик',
  'setup.text': 'Расскажи, в какие часы у тебя есть время и сколько практик в неделю ты хочешь. Каждое воскресенье вечером приходит план с реальными партнёрами.',
  'setup.action': 'Настроить план',
  'paused.title': 'Твой план на паузе',
  'paused.text': 'Новые практики не планируются, пока ты снова не включишь план.',
  'paused.action': 'Продолжить план',
  'paused.busy': 'Включаем…',
  'done.title': 'Цель недели выполнена',
  'done.text': 'Сделано {a} из {t}. Всё, что сверху на этой неделе, — бонус.',
  'done.action': 'Написать партнёру',
  'noMatch.title': 'Пока нет партнёра на твоё время',
  'noMatch.action': 'Изменить свободное время',
  'noMatch.no_times': 'На эту неделю у тебя нет свободного времени. Добавь пару часов — и следующий план включит тебя.',
  'noMatch.no_overlap': 'Подходящие партнёры пока не свободны в те же часы. Чем больше свободного времени, тем больше вариантов у плана.',
  'noMatch.no_partner_left': 'У всех, кто свободен в твои часы, неделя уже заполнена. В следующем плане ты в начале очереди.',
  'noMatch.replacement_not_found': 'Партнёр не смог прийти, а другое время на этой неделе пока не нашлось. Твоё свободное время остаётся открытым для следующего плана.',
  'noMatch.added': 'Добавлено — ищем снова',
  'noMatch.addedText': '{label} теперь в твоём свободном времени.',
  'noMatch.popular': 'Многие занимаются в {label}. Добавь это время — у плана будет больше вариантов.',
  'noMatch.add': 'Добавить {label}',
  'noMatch.adding': 'Добавляем…',
  'looking.title': 'Ищем партнёров · {days}',
  'looking.titleWeek': 'Ищем партнёров на эту неделю',
  'looking.text': 'Когда найдётся кто-то под твоё время, практика появится здесь для подтверждения.',
  'waiting.title': 'Следующий план придёт в воскресенье вечером',
  'waiting.text': 'Ты получишь практики на неделю для подтверждения.',
  sooner: 'Хочешь поговорить раньше? Напиши тому, с кем у тебя уже была практика.',
  partners: 'Партнёры',
  'free.title': 'Бесплатные практики закончились',
  'free.text': 'AInur и звонки с друзьями остаются бесплатными.',
  'packages.none': 'Запланированных практик не осталось.',
  'packages.see': 'Посмотреть пакеты',
  'limit.title': 'Пока одна практика в неделю',
  'limit.text': ({ missed, left, usual }) => `За последние 4 недели пропущено подтверждённых практик: ${missed}. `
    + `Приходи на ${left === 1 ? 'следующую практику' : `следующие ${left}`} — и план снова станет ${usual} в неделю.`,

  'checkin.title': 'Следующая неделя — в твоё обычное время',
  'checkin.text': ({ days, n }) => `${days} · ${n} ${ruPlural(n, 'практика', 'практики', 'практик')}, каждая с реальным партнёром. План придёт в воскресенье вечером.`,
  'checkin.change': 'Изменить часы',
  'checkin.off': 'Пропустить неделю',
  saving: 'Сохраняем…',
  saveError: 'Не удалось сохранить. Проверь интернет.',

  'week.title': 'Расскажи о своей обычной неделе',
  'week.text': 'Отметь часы: «Свободно», «Может быть» и «Никогда». Это общая информация, чтобы лучше планировать, — без твоего «да» мы не назначаем ни одного звонка.',
  'week.open': 'Открыть мою неделю',
  'week.later': 'Позже',

  'topic.kicker': 'Тема практики на сегодня',
  'topic.day': 'День {day}',
  'topic.fallback': 'Тема дня',
  'topic.ctaFull': 'Слушать, читать, слова и вопросы',
  'topic.ctaShort': 'Слова, идиомы и вопросы',
};

export const PRACTICE_COPY = { en, az, tr, ru };

export function practiceText(lang, key, vars) {
  const raw = (PRACTICE_COPY[lang] && PRACTICE_COPY[lang][key]) ?? en[key] ?? key;
  if (typeof raw === 'function') return raw(vars || {});
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

// "Mon, Wed, Fri" in the learner's language (weekdays 0 = Sunday, shown
// Monday first as myWeek.dayNames does).
export function practiceDayNames(lang, days) {
  return [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => (days || []).includes(d))
    .map((d) => practiceText(lang, `day.${d}`))
    .join(', ');
}

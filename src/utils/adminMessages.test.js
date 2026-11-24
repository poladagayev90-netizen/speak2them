import {
  formatSlotLocal,
  formatTwoSlots,
  matchNotifyMessage,
  softPauseCheckMessage,
  academyGuideMessage,
  inviteRegularMessage,
  newcomerGridMessage,
  waHref,
} from './adminMessages';

test('formatSlotLocal converts Baku slot to Istanbul (-1h) and uses the learner language', () => {
  // 2026-11-24 is Tuesday. 20:00 Baku = 19:00 Istanbul.
  expect(formatSlotLocal('2026-11-24-20', 'Europe/Istanbul', 'tr')).toBe('Salı 19:00');
  expect(formatSlotLocal('2026-11-24-20', 'Asia/Baku', 'az')).toBe('Çərşənbə axşamı 20:00');
  expect(formatSlotLocal('2026-11-24-20', 'Asia/Baku', 'en')).toBe('Tuesday 20:00');
  expect(formatSlotLocal('2026-11-24-20', 'Asia/Baku', 'ru')).toBe('вторник 20:00');
});

test('matchNotifyMessage uses polite Siz, reflects partnerAccepted & level truthfully, and omits alternative hours', () => {
  const booked = matchNotifyMessage({
    kind: 'booked', lang: 'tr', name: 'Samet Eroglu', partnerName: 'Polad',
    partnerLevel: '', slotId: '2026-11-24-21', timeZone: 'Europe/Istanbul',
    altSlots: ['2026-11-25-20', '2026-11-26-19'],
  });
  expect(booked).toMatch(/^Merhaba Samet!/);
  expect(booked).toContain('Salı 20:00');
  expect(booked).toContain('Polad');
  expect(booked).not.toContain('()');
  expect(booked).toContain('Bu saat sizin için uygun mu?');
  expect(booked).not.toContain('Çarşamba');
  expect(booked).not.toContain('Perşembe');
  expect(booked.toLowerCase()).not.toMatch(/pratiğin\b|onaylarsan|yerin\b/);

  const pendingConfirmedPeer = matchNotifyMessage({
    kind: 'pending', lang: 'az', name: 'Ravin', partnerName: 'Xəlil',
    partnerLevel: 'A1', partnerAccepted: true,
    slotId: '2026-11-24-19', timeZone: 'Asia/Baku', accepted: false,
  });
  expect(pendingConfirmedPeer).toContain('Xəlil (A1)');
  expect(pendingConfirmedPeer).toContain('sizinlə praktikanı artıq təsdiqləyib');
  expect(pendingConfirmedPeer).toContain('Bu saat sizin üçün uyğundurmu?');
  expect(pendingConfirmedPeer).not.toContain('20:00');

  const pendingUnconfirmedPeer = matchNotifyMessage({
    kind: 'pending', lang: 'az', name: 'Zahra Ali', partnerName: 'Sabina',
    partnerLevel: 'B1', partnerAccepted: false,
    slotId: '2026-11-24-19', timeZone: 'Asia/Baku', accepted: false,
  });
  expect(pendingUnconfirmedPeer).toContain('Sabina (B1)');
  expect(pendingUnconfirmedPeer).not.toContain('artıq təsdiqləyib');
  expect(pendingUnconfirmedPeer.toLowerCase()).not.toMatch(/hazır|qorx|yoxla|imtahan/);

  const pendingRu = matchNotifyMessage({
    kind: 'pending', lang: 'ru', name: 'Ivan', partnerName: 'Polad',
    slotId: '2026-11-24-19', timeZone: 'Asia/Baku', accepted: false,
  });
  expect(pendingRu).toContain('Здравствуйте, Ivan!');
  expect(pendingRu).toContain('Это время вам подходит?');
  expect(pendingRu.toLowerCase()).not.toMatch(/\bтебя\b|\bтвоя\b/);

  const pendingEn = matchNotifyMessage({
    kind: 'pending', lang: 'en', name: 'Sam', partnerName: 'Polad', partnerAccepted: true,
    slotId: '2026-11-24-19', timeZone: 'Asia/Baku', accepted: false,
  });
  expect(pendingEn).toContain('Polad already confirmed');
  expect(pendingEn).toContain('Does this time work for you?');
});

test('softPauseCheckMessage uses polite Siz across all 4 languages without fear/ready wording', () => {
  for (const lang of ['az', 'tr', 'ru', 'en']) {
    const msg = softPauseCheckMessage({ lang, name: 'Asli' });
    expect(msg).toContain('Asli');
    expect(msg.toLowerCase()).not.toMatch(/hazır|ready|qorx|yoxla|imtahan/);
  }
  expect(softPauseCheckMessage({ lang: 'az', name: 'Asli' })).toContain('dayandıra bilərik');
});

test('academyGuideMessage embeds valid speaklab.me/academy chapter URL across all languages', () => {
  expect(academyGuideMessage({ lang: 'az', name: 'Emil', chapterKey: 'install' }))
    .toContain('https://speaklab.me/academy/?c=T02&ch=ch1&lang=az');
  expect(academyGuideMessage({ lang: 'tr', name: 'Emil', chapterKey: 'schedule' }))
    .toContain('https://speaklab.me/academy/?c=T02&ch=ch2&lang=tr');
  expect(academyGuideMessage({ lang: 'ru', name: 'Ivan', chapterKey: 'call' }))
    .toContain('https://speaklab.me/academy/?c=T02&ch=ch3&lang=az');
});

test('newcomerGridMessage offers 2 concrete times when provided, uses polite Siz, and omits hours when empty', () => {
  const withSlots = newcomerGridMessage({
    lang: 'az', name: 'Imran Hashimov', slots: ['2026-11-24-19', '2026-11-26-21'], timeZone: 'Asia/Baku',
  });
  expect(withSlots).toContain('Çərşənbə axşamı 19:00 yoxsa Cümə axşamı 21:00');
  expect(withSlots).toContain('səviyyənizə');
  expect(withSlots.toLowerCase()).not.toMatch(/hazır|qorx|yoxla|imtahan/);

  for (const lang of ['az', 'tr', 'ru', 'en']) {
    const bare = newcomerGridMessage({ lang, name: 'Test User', slots: [] });
    expect(bare).not.toMatch(/\d{1,2}:\d{2}/);
  }
});

test('inviteRegularMessage and formatTwoSlots work across all 4 languages with polite Siz', () => {
  expect(formatTwoSlots(['2026-11-24-19', '2026-11-25-20'], 'Asia/Baku', 'en')).toBe('Tuesday 19:00 or Wednesday 20:00');
  const msg = inviteRegularMessage({
    lang: 'az', name: 'Sabina', targetName: 'Khadija', targetLevel: 'A2',
    slots: ['2026-11-24-19', '2026-11-25-20'], timeZone: 'Asia/Baku',
  });
  expect(msg).toContain('Sabina');
  expect(msg).toContain('Khadija (A2)');
  expect(msg).toContain('istəyərsiniz');
  expect(msg).toContain('Çərşənbə axşamı 19:00 yoxsa Çərşənbə 20:00');
  expect(waHref('+994 50 111 22 33', 'Hi')).toBe('https://wa.me/994501112233?text=Hi');
  expect(waHref('', 'Hi')).toBeNull();
});

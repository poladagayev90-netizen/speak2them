import {
  formatSlotLocal, formatTwoSlots, matchNotifyMessage, inviteRegularMessage, newcomerGridMessage, waHref,
} from './adminMessages';

test('formatSlotLocal converts Baku slot to Istanbul (-1h) and uses the learner language', () => {
  // 2026-11-24 is Tuesday. 20:00 Baku = 19:00 Istanbul.
  expect(formatSlotLocal('2026-11-24-20', 'Europe/Istanbul', 'tr')).toBe('Salı 19:00');
  expect(formatSlotLocal('2026-11-24-20', 'Asia/Baku', 'az')).toBe('Çərşənbə axşamı 20:00');
  expect(formatSlotLocal('2026-11-24-20', 'Asia/Baku', 'en')).toBe('Tuesday 20:00');
  expect(formatSlotLocal('2026-11-24-20', 'Asia/Baku', 'ru')).toBe('вторник 20:00');
});

test('matchNotifyMessage renders booked and pending messages with no fear or exam words', () => {
  const booked = matchNotifyMessage({
    kind: 'booked', lang: 'tr', name: 'Samet Eroglu', partnerName: 'Polad',
    slotId: '2026-11-24-21', timeZone: 'Europe/Istanbul',
  });
  expect(booked).toMatch(/^Merhaba Samet!/);
  expect(booked).toContain('Salı 20:00');
  expect(booked).toContain('Polad');

  const pending = matchNotifyMessage({
    kind: 'pending', lang: 'az', name: 'Zahra Ali', partnerName: 'Sabina',
    slotId: '2026-11-24-19', timeZone: 'Asia/Baku', accepted: false,
    altSlots: ['2026-11-25-20', '2026-11-26-19'],
  });
  expect(pending).toContain('Sabina');
  expect(pending).toContain('Çərşənbə 20:00 yoxsa Cümə axşamı 19:00');
  expect(pending.toLowerCase()).not.toMatch(/hazır|qorx|yoxla|imtahan/);
});

test('newcomerGridMessage offers 2 concrete times when provided and omits hours when empty', () => {
  const withSlots = newcomerGridMessage({
    lang: 'az', name: 'Imran Hashimov', slots: ['2026-11-24-19', '2026-11-26-21'], timeZone: 'Asia/Baku',
  });
  expect(withSlots).toContain('Çərşənbə axşamı 19:00 yoxsa Cümə axşamı 21:00');
  expect(withSlots.toLowerCase()).not.toMatch(/hazır|qorx|yoxla|imtahan/);

  for (const lang of ['az', 'tr', 'ru', 'en']) {
    const bare = newcomerGridMessage({ lang, name: 'Test User', slots: [] });
    expect(bare).not.toMatch(/\d{1,2}:\d{2}/);
  }
});

test('inviteRegularMessage and formatTwoSlots work across all 4 languages', () => {
  expect(formatTwoSlots(['2026-11-24-19', '2026-11-25-20'], 'Asia/Baku', 'en')).toBe('Tuesday 19:00 or Wednesday 20:00');
  const msg = inviteRegularMessage({
    lang: 'az', name: 'Sabina', targetName: 'Khadija', targetLevel: 'A2',
    slots: ['2026-11-24-19', '2026-11-25-20'], timeZone: 'Asia/Baku',
  });
  expect(msg).toContain('Sabina');
  expect(msg).toContain('Khadija (A2)');
  expect(msg).toContain('Çərşənbə axşamı 19:00 yoxsa Çərşənbə 20:00');
  expect(waHref('+994 50 111 22 33', 'Hi')).toBe('https://wa.me/994501112233?text=Hi');
  expect(waHref('', 'Hi')).toBeNull();
});

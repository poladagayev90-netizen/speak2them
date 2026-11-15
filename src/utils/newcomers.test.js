import { newcomerRows, newcomerSteps, newcomerLang, newcomerMessage, newcomerWhatsApp } from './newcomers';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const DAY = 86400000;
const ts = (ms) => ({ toMillis: () => ms });

test('steps follow the data, booking counts from upcomingCall, a loaded pair or a call', () => {
  const bare = newcomerSteps({ user: {} });
  expect(bare.map((s) => s.done)).toEqual([true, false, false, false, false, false]);
  const mid = newcomerSteps({ user: { upcomingCall: { id: 'x' } }, ob: { whatsapp: '+994501234567' }, warmedUp: true });
  expect(mid.map((s) => s.done)).toEqual([true, true, true, true, true, false]);
  expect(newcomerSteps({ user: {}, ob: {}, booked: true }).find((s) => s.key === 'booked').done).toBe(true);
  expect(newcomerSteps({ user: { callCount: 1 } }).every((s) => ['wizard', 'whatsapp', 'warmup'].includes(s.key) || s.done)).toBe(true);
});

test('language: first-run pick, then app / report language, only az/tr/ru/en', () => {
  expect(newcomerLang({ guideLanguage: 'ru', appLanguage: 'az' })).toBe('ru');
  expect(newcomerLang({ guideLanguage: 'de', preferredLanguage: 'tr' })).toBe('tr');
  expect(newcomerLang({})).toBe('en');
});

test('message uses the first name, switches after the first practice, names no hour', () => {
  expect(newcomerMessage('az', 'Leyla Aliyeva')).toMatch(/^Salam, Leyla! Mən Polad/);
  expect(newcomerMessage('tr', '', false)).toMatch(/^Merhaba! Ben Polad/);
  expect(newcomerMessage('ru', 'Ivan', true)).toMatch(/первая практика/);
  expect(newcomerMessage('xx', 'Sam')).toMatch(/^Hi Sam!/);
  for (const l of ['az', 'tr', 'ru', 'en']) {
    expect(newcomerMessage(l, 'A')).not.toMatch(/\d{1,2}:\d{2}/);
  }
});

test('whatsapp link needs digits and carries the text', () => {
  expect(newcomerWhatsApp('', 'x')).toBeNull();
  expect(newcomerWhatsApp('+994 50 123', 'Hi there')).toBe('https://wa.me/99450123?text=Hi%20there');
});

test('rows: last 14 days only, newest first, skip honoured, wizard-less people included', () => {
  const users = [
    { id: 'old', name: 'Old', createdAt: ts(NOW - 20 * DAY) },
    { id: 'a', name: 'Aysel', createdAt: ts(NOW - 2 * DAY), guideLanguage: 'az' },
    { id: 'b', name: 'Bora', createdAt: ts(NOW - 3 * 3600000), callCount: 1, appLanguage: 'tr' },
    { id: 'adm', name: 'Admin', createdAt: ts(NOW - DAY) },
  ];
  const onboarding = new Map([['a', { whatsapp: '+994501112233', level: 'A2' }]]);
  const rows = newcomerRows({ users, onboarding, now: NOW, skip: (u) => u.id === 'adm' });
  expect(rows.map((r) => r.uid)).toEqual(['b', 'a']);
  const [b, a] = rows;
  expect(b.days).toBe(0);
  expect(b.noFirst).toBe(false);
  expect(b.whatsapp).toBeNull();
  expect(a.days).toBe(2);
  expect(a.noFirst).toBe(true);
  expect(a.level).toBe('A2');
  expect(a.whatsapp).toMatch(/^https:\/\/wa\.me\/994501112233\?text=Salam%2C%20Aysel!/);
  expect(a.reached).toBe(3);
});

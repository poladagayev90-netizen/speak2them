import { pickFirstRunLang, languageFields, isFirstDay } from './firstRunLang';
import { FIRST_RUN_COPY, firstRunText } from '../data/firstRunCopy';

describe('pickFirstRunLang', () => {
  it('takes the first supported device language', () => {
    expect(pickFirstRunLang(['de-DE', 'ru-RU', 'az'])).toBe('ru');
    expect(pickFirstRunLang(['tr'])).toBe('tr');
  });
  it('falls back to English', () => {
    expect(pickFirstRunLang(['de', 'fr'])).toBe('en');
    expect(pickFirstRunLang([])).toBe('en');
    expect(pickFirstRunLang(null)).toBe('en');
  });
});

describe('languageFields', () => {
  it('makes az/tr the feedback language too', () => {
    expect(languageFields('az')).toEqual({ guideLanguage: 'az', preferredLanguage: 'az', appLanguage: 'az' });
  });
  it('leaves the feedback language alone for ru/en', () => {
    expect(languageFields('ru')).toEqual({ guideLanguage: 'ru' });
    expect(languageFields('en')).toEqual({ guideLanguage: 'en' });
  });
  it('ignores anything else', () => {
    expect(languageFields('de')).toEqual({});
  });
});

describe('isFirstDay', () => {
  const now = Date.UTC(2026, 9, 14, 12);
  it('is true for an account younger than a day', () => {
    expect(isFirstDay({ createdAt: { seconds: (now - 3600e3) / 1000 }, callCount: 2 }, now)).toBe(true);
  });
  it('is false for an older account', () => {
    expect(isFirstDay({ createdAt: { seconds: (now - 30 * 3600e3) / 1000 } }, now)).toBe(false);
  });
  it('treats a pending createdAt as new unless they have practised', () => {
    expect(isFirstDay({ createdAt: null, callCount: 0 }, now)).toBe(true);
    expect(isFirstDay({ callCount: 3 }, now)).toBe(false);
    expect(isFirstDay(null, now)).toBe(false);
  });
});

describe('firstRunCopy', () => {
  const keys = Object.keys(FIRST_RUN_COPY.en).sort();
  it.each(['az', 'tr', 'ru'])('%s has every English key and no empty value', (lang) => {
    expect(Object.keys(FIRST_RUN_COPY[lang]).sort()).toEqual(keys);
    for (const k of keys) expect(String(FIRST_RUN_COPY[lang][k]).trim()).not.toBe('');
  });
  it.each(['az', 'tr', 'ru'])('%s keeps the same {placeholders}', (lang) => {
    const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
    for (const k of keys) {
      if (k === 'reg.title') continue; // {…} marks the accented word there
      expect([k, ph(FIRST_RUN_COPY[lang][k])]).toEqual([k, ph(FIRST_RUN_COPY.en[k])]);
    }
  });
  it('fills placeholders and falls back to English', () => {
    expect(firstRunText('az', 'ob.phone.ok', { n: '+994501234567' })).toBe('+994501234567 nömrəsinə yazacağıq');
    expect(firstRunText('xx', 'ob.continue')).toBe('Continue');
  });
});

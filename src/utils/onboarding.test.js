import { normalizeWhatsApp, isWhatsApp, whatsAppLink, dialCodeFor, needsOnboarding, ONBOARDING_VERSION } from './onboarding';

describe('normalizeWhatsApp', () => {
  it('adds the chosen code and drops the local leading zero', () => {
    expect(normalizeWhatsApp('050 123 45 67', '994')).toBe('+994501234567');
    expect(normalizeWhatsApp('(050) 123-45-67', '994')).toBe('+994501234567');
    expect(normalizeWhatsApp('501234567', '994')).toBe('+994501234567');
    expect(normalizeWhatsApp('0532 123 45 67', '90')).toBe('+905321234567');
  });
  it('keeps a number typed with its own code', () => {
    expect(normalizeWhatsApp('+90 532 123 45 67', '994')).toBe('+905321234567');
    expect(normalizeWhatsApp('00994501234567', '90')).toBe('+994501234567');
    expect(normalizeWhatsApp('994501234567', '994')).toBe('+994501234567');
  });
  it('a short local number that merely starts like the code is still local', () => {
    // 99 412 34 56 is an Azerbaijani local number, not «+994 1234 56».
    expect(normalizeWhatsApp('994123456', '994')).toBe('+994994123456');
  });
  it('Russia: the trunk 8 becomes +7', () => {
    expect(normalizeWhatsApp('8 916 123 45 67', '7')).toBe('+79161234567');
  });
  it('refuses what cannot be a number', () => {
    expect(normalizeWhatsApp('', '994')).toBe('');
    expect(normalizeWhatsApp('12', '994')).toBe('');
    expect(normalizeWhatsApp('+0123456789', '994')).toBe('');
    expect(normalizeWhatsApp('+99450123456789012', '994')).toBe('');
    expect(normalizeWhatsApp('abc', '994')).toBe('');
  });
  it('isWhatsApp is the same check the rules make', () => {
    expect(isWhatsApp('+994501234567')).toBe(true);
    expect(isWhatsApp('994501234567')).toBe(false);
    expect(isWhatsApp('+12345678')).toBe(true);
    expect(isWhatsApp('+1234567')).toBe(false);
  });
});

describe('WhatsApp helpers', () => {
  it('builds the team link with a greeting', () => {
    expect(whatsAppLink('+994501234567', 'Aysel Məmmədova'))
      .toBe(`https://wa.me/994501234567?text=${encodeURIComponent('Salam Aysel, SpeakLab-dan yazıram.')}`);
    expect(whatsAppLink('', 'x')).toBeNull();
  });
  it('picks the dial code from the country', () => {
    expect(dialCodeFor('Türkiye')).toBe('90');
    expect(dialCodeFor('Kazakhstan')).toBe('7');
    expect(dialCodeFor('Other')).toBe('994');
  });
  it('version 2 learners are asked again; teachers never', () => {
    expect(ONBOARDING_VERSION).toBe(3);
    expect(needsOnboarding({ uid: 'u', onboardingVersion: 2 })).toBe(true);
    expect(needsOnboarding({ uid: 'u', onboardingVersion: 3 })).toBe(false);
    expect(needsOnboarding({ uid: 'u', role: 'teacher', onboardingVersion: 0 })).toBe(false);
  });
});

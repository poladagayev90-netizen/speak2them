import React from 'react';
import { ONBOARDING_VERSION } from './onboarding';
import { resolveFirstRunLang } from './firstRunLang';
import { getFeedbackLanguage } from './feedbackLanguage';

export const GUEST_STORAGE_KEY = 'slk_guest';

export const GuestContext = React.createContext({
  enterGuest: () => {},
  exitGuest: () => {},
});

export const isGuestUser = (user) => Boolean(user?.isGuest);

export function readGuestFlag() {
  try {
    return sessionStorage.getItem(GUEST_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGuestFlag(on) {
  try {
    if (on) sessionStorage.setItem(GUEST_STORAGE_KEY, '1');
    else sessionStorage.removeItem(GUEST_STORAGE_KEY);
  } catch { /* private mode */ }
}

export function buildGuestUser() {
  return {
    uid: null,
    isGuest: true,
    name: 'Guest',
    displayName: 'Guest',
    role: 'student',
    onboardingVersion: ONBOARDING_VERSION,
    guideLanguage: resolveFirstRunLang(),
    preferredLanguage: getFeedbackLanguage(),
    callCount: 0,
  };
}

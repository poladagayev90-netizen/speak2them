// Newcomer SpeakLab Academy pop-up rules (2026-11-24).
// Shows up to ACADEMY_POPUP_MAX_SHOWS times (at most once per day) for real,
// non-teacher/non-admin learners who have not completed a call yet, and stops
// permanently once they open Academy from anywhere in the app.

import { isAdminUser } from '../constants';

export const ACADEMY_POPUP_MAX_SHOWS = 3;

const STORAGE_PREFIX = 'sl.academyPopup.';

function readState(uid) {
  if (!uid) return { shows: 0, lastDate: null, opened: false };
  try {
    const raw = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${uid}`) || '{}') || {};
    return {
      shows: Number(raw.shows) || 0,
      lastDate: raw.lastDate || null,
      opened: raw.opened === true,
    };
  } catch {
    return { shows: 0, lastDate: null, opened: false };
  }
}

function writeState(uid, state) {
  if (!uid) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${uid}`, JSON.stringify(state));
  } catch { /* private mode */ }
}

export function shouldShowAcademyPopup(user, todayStr = new Date().toDateString()) {
  if (!user?.uid || user.isGuest) return false;
  if (user.role === 'teacher' || isAdminUser(user)) return false;
  if ((Number(user.callCount) || 0) > 0) return false;
  const s = readState(user.uid);
  if (s.opened) return false;
  if (s.shows >= ACADEMY_POPUP_MAX_SHOWS) return false;
  if (s.lastDate === todayStr) return false;
  return true;
}

export function markAcademyPopupShown(uid, todayStr = new Date().toDateString()) {
  if (!uid) return;
  const s = readState(uid);
  writeState(uid, {
    ...s,
    shows: s.shows + 1,
    lastDate: todayStr,
  });
}

export function markAcademyOpened(uid) {
  if (!uid) return;
  const s = readState(uid);
  writeState(uid, {
    ...s,
    opened: true,
  });
}

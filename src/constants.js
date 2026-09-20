export const ADMIN_UID = '6Djehd9KB8dTZUgVwVJfLoPI5dF3';

// REACT_APP_FUNCTIONS_BASE exists only for local emulator builds (see firebase.js).
export const FUNCTIONS_BASE = process.env.REACT_APP_FUNCTIONS_BASE || 'https://us-central1-speak2them-64f2b.cloudfunctions.net';

// The team's business WhatsApp. It was written out in three places (the
// install gate, the upgrade screen, and now the intro call), which is three
// places to miss when the number changes.
//
// It is the 1-to-1 channel for now: intro calls are arranged HERE, by hand,
// rather than through the in-app slot board. The board and everything behind
// it (reminders, admin outcomes, introDoneAt) still work and are still used by
// the admin — only the learner's first step moved to WhatsApp.
export const SUPPORT_WHATSAPP = '994513549195';
export const whatsappLink = (text) =>
  `https://wa.me/${SUPPORT_WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

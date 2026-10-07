export const ADMIN_UID = '6Djehd9KB8dTZUgVwVJfLoPI5dF3';
// A second admin account (Polad 2026-10-07) is recognised by its VERIFIED
// e-mail — the same list as firestore.rules isAdmin() and functions/index.js
// ADMIN_EMAILS. ADMIN_UID stays the admin IDENTITY (the admin's own students,
// pushes, unlimited practice); this decides who may open the admin tools.
export const ADMIN_EMAILS = ['poladagayev90@gmail.com', 'agayevpoli7@gmail.com'];
export const isAdminUser = (user) => !!user && (user.uid === ADMIN_UID
  || (user.emailVerified === true && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())));

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

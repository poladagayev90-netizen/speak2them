const { Timestamp } = require('firebase-admin/firestore');

// Same id the client builds (src/utils/chat.js chatIdFor): the two uids, sorted.
const chatIdFor = (a, b) => [a, b].sort().join('_');

// After a real call both people get a thread with each other, so a partner
// they liked is one tap away instead of lost in a list of strangers.
//
// Only CREATES. A pair that already has a chat keeps it exactly as it is —
// bumping updatedAt would reorder their list and a rewritten lastMessage would
// hide what was actually said last.
//
// No message document is written. notifyChatMessage would raise the unread
// badge for only one side (it treats the sender as the other), and older app
// builds would draw a server line as a bubble from the partner.
//
// Skipped when either side blocked the other or asked not to be paired again:
// a chat is a way back to someone, and those people asked for no way back.
async function ensurePostCallChat(db, people, seconds, nowMs = Date.now()) {
  const [a, b] = people;
  if (!a || !b || a === b) return 'skipped';
  if (a === 'ainur' || b === 'ainur') return 'skipped';
  const chatRef = db.doc(`chats/${chatIdFor(a, b)}`);
  return db.runTransaction(async (tx) => {
    const [chat, ...guards] = await Promise.all([
      tx.get(chatRef),
      tx.get(db.doc(`users/${a}/blocked/${b}`)),
      tx.get(db.doc(`users/${b}/blocked/${a}`)),
      tx.get(db.doc(`users/${a}/avoid/${b}`)),
      tx.get(db.doc(`users/${b}/avoid/${a}`)),
    ]);
    if (chat.exists) return 'exists';
    if (guards.some((g) => g.exists)) return 'blocked';
    const minutes = Math.max(1, Math.round(seconds / 60));
    tx.set(chatRef, {
      participants: [a, b].sort(),
      updatedAt: Timestamp.fromMillis(nowMs),
      lastMessage: `You talked for ${minutes} min — say hi`,
      unread: {},
      createdBy: 'post_call',
    });
    return 'created';
  });
}

module.exports = { ensurePostCallChat, chatIdFor };

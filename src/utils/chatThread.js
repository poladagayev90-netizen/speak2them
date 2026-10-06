// The conversation as the thread draws it (components/chat/ChatThread.jsx):
// a day line where the date changes, and consecutive messages from the same
// person grouped so only the last of a run carries the bubble's tail.
// Pure, so it can be tested.

export const EDIT_WINDOW_MS = 15 * 60 * 1000; // firestore.rules: the same 15 minutes
const GROUP_GAP_MS = 5 * 60 * 1000;

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(date, now = new Date()) {
  const today = new Date(now);
  const yesterday = new Date(now.getTime() - 86400000);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === today.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

export function timeLabel(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// messages: [{ id, senderId, createdAt: Date|null, ... }] in order.
// → [{ type: 'day', key, label } | { type: 'msg', key, msg, first, last }]
export function threadItems(messages, now = new Date()) {
  const out = [];
  let prevDay = null;
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    // A message still on its way has no server time yet: it belongs to now.
    const at = m.createdAt instanceof Date ? m.createdAt : now;
    const key = dayKey(at);
    if (key !== prevDay) {
      out.push({ type: 'day', key: `day-${key}`, label: dayLabel(at, now) });
      prevDay = key;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const atOf = (x) => (x && x.createdAt instanceof Date ? x.createdAt : now);
    const joins = (a, b) => a && b && a.senderId === b.senderId && a.kind !== 'analysis' && b.kind !== 'analysis'
      && dayKey(atOf(a)) === dayKey(atOf(b)) && Math.abs(atOf(b) - atOf(a)) < GROUP_GAP_MS;
    out.push({ type: 'msg', key: m.id, msg: m, first: !joins(prev, m), last: !joins(m, next) });
  }
  return out;
}

export function canEditMessage(msg, uid, nowMs = Date.now()) {
  if (!msg || msg.senderId !== uid || msg.deleted || msg.kind || msg.pending) return false;
  const at = msg.createdAt instanceof Date ? msg.createdAt.getTime() : 0;
  return !!at && nowMs - at < EDIT_WINDOW_MS - 30000; // a little slack before the rules' limit
}

export const canDeleteForEveryone = (msg, uid) => !!msg && msg.senderId === uid && !msg.deleted && !msg.kind;

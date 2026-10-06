// What the person chose on the Android ringing screen (CallMessagingService:
// Answer / Decline), handed from the push tap to GlobalCallListener. The tap
// usually lands BEFORE the call document has reached the app — so the choice
// waits here and is used once the ringing call from that person shows up.
const KEEP_MS = 45000;
let pending = null;
const listeners = new Set();

export function setCallIntent(action, callerId) {
  if (action !== 'answer' && action !== 'decline') return;
  pending = { action, callerId: callerId || null, at: Date.now() };
  listeners.forEach((fn) => fn());
}

// The choice for this ringing call, once; null when there is none (or it is old).
export function takeCallIntent(callerId, now = Date.now()) {
  if (!pending || now - pending.at > KEEP_MS) { pending = null; return null; }
  if (pending.callerId && callerId && pending.callerId !== callerId) return null;
  const { action } = pending;
  pending = null;
  return action;
}

export function onCallIntent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

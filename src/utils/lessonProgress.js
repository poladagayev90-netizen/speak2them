import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Which lessons a learner has read: lessonProgress/{uid} (or localStorage when
// exploring as a guest without an account).
//
// WRITTEN BY THE CLIENT, unlike attendance or introDoneAt, and that is safe
// because nothing in the app is granted by it — no minutes, no unlocked call,
// no badge. It records what somebody has read, for their own map. If it were
// server-written every card turn would cost a function call for a tick mark.
//
// Shape: { uid, completed: { [lessonId]: ms }, lastLessonId, updatedAt }.

const GUEST_LESSONS_KEY = 'sl.guestLessons';
const GUEST_LESSONS_EVENT = 'sl:guestLessons';

function readGuestLessons() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUEST_LESSONS_KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : { completed: {} };
  } catch {
    return { completed: {} };
  }
}

export function subscribeToLessonProgress(uid, cb) {
  if (!uid) {
    cb(readGuestLessons());
    const onUpdate = () => cb(readGuestLessons());
    window.addEventListener(GUEST_LESSONS_EVENT, onUpdate);
    return () => window.removeEventListener(GUEST_LESSONS_EVENT, onUpdate);
  }
  return onSnapshot(
    doc(db, 'lessonProgress', uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => { console.warn('[lessons] progress failed', err.code); cb(null); },
  );
}

// Marks one lesson read. Merges, so a second device cannot wipe the first
// one's ticks, and the timestamps inside the map are client millis on purpose:
// a serverTimestamp() sentinel cannot live inside a map value that rules also
// have to validate, and nothing depends on this clock being honest.
export async function markLessonDone(uid, lessonId) {
  if (!lessonId) return { ok: false };
  if (!uid) {
    try {
      const cur = readGuestLessons();
      const next = {
        completed: { ...(cur.completed || {}), [lessonId]: Date.now() },
        lastLessonId: lessonId,
      };
      localStorage.setItem(GUEST_LESSONS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(GUEST_LESSONS_EVENT));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
  try {
    await setDoc(doc(db, 'lessonProgress', uid), {
      uid,
      completed: { [lessonId]: Date.now() },
      lastLessonId: lessonId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (e) {
    // A failed tick must never block the reader: the lesson was still read, and
    // the next one is still one tap away.
    console.warn('[lessons] could not save progress', e.code || e.message);
    return { ok: false };
  }
}

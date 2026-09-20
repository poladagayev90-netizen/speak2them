import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Which lessons a learner has read: lessonProgress/{uid}.
//
// WRITTEN BY THE CLIENT, unlike attendance or introDoneAt, and that is safe
// because nothing in the app is granted by it — no minutes, no unlocked call,
// no badge. It records what somebody has read, for their own map. If it were
// server-written every card turn would cost a function call for a tick mark.
//
// Course progress elsewhere in the app is DERIVED (cycleTick − startTick) and
// deliberately not stored per user. This cannot be derived from anything: only
// the learner knows they have read a page, so it is stored — one document, one
// map, one write per lesson.
//
// Shape: { uid, completed: { [lessonId]: ms }, lastLessonId, updatedAt }.

export function subscribeToLessonProgress(uid, cb) {
  if (!uid) { cb(null); return () => {}; }
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
  if (!uid || !lessonId) return { ok: false };
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

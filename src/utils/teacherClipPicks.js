import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { describeVideos } from '../data/describeVideos';

// A teacher's own describe clips for a topic: teacherClipPicks/{uid}.
//
// Polad 2026-11-17: a teacher prepares the lesson BEFORE it — picks the clips
// that fit their student from the whole deck, and the topic sheet's Videos tab
// then shows those instead of the rotation's six. Only the teacher's own sheet
// changes: the in-call Video stage stays on videosForTopic, because both
// phones in a call must build the same list from the day alone.
//
// Client-written, like lessonProgress, and safe for the same reason: nothing
// is granted by it — the clips are public files, this only orders a list.
//
// Shape: { uid, days: { [day]: [clipId, …] }, updatedAt }. An empty list means
// «back to the topic's own clips».

export const MAX_PICKS = 12;

const byId = new Map(describeVideos.map((v) => [v.id, v]));

export function subscribeToClipPicks(uid, cb) {
  if (!uid) { cb(null); return () => {}; }
  return onSnapshot(
    doc(db, 'teacherClipPicks', uid),
    (snap) => cb(snap.exists() ? (snap.data().days || {}) : {}),
    (err) => { console.warn('[clips] picks failed', err.code); cb({}); },
  );
}

// The picked clips for a day, as clip objects; ids the deck no longer has are
// dropped (a renamed clip must not leave a dead slot on a shared screen).
export function pickedClips(days, day) {
  const ids = (days && days[String(day)]) || [];
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// Merge: picks for one topic never touch another topic's.
export async function saveClipPicks(uid, day, ids) {
  if (!uid || !day) return { ok: false };
  const clean = [...new Set(ids)].filter((id) => byId.has(id)).slice(0, MAX_PICKS);
  try {
    await setDoc(doc(db, 'teacherClipPicks', uid), {
      uid,
      days: { [String(day)]: clean },
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { ok: true };
  } catch (e) {
    console.warn('[clips] could not save picks', e.code || e.message);
    return { ok: false };
  }
}

import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// "I'd like to practise with them again" — the opposite of the avoid list.
//
// users/{uid}/favorites/{peerId}: the document's existence is the wish. Owner
// only (rules), like blocked/avoid: the other person is never told, so a star
// that is not returned costs nobody anything. The weekly planner reads the
// lists server-side and gives a starred pair a better score — a mutual star a
// clearly better one — but a star is a preference, never a promise: the two
// still have to be free at the same hours.
export function subscribeToFavorites(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, 'users', uid, 'favorites'),
    (snap) => cb(new Set(snap.docs.map((d) => d.id))),
    () => cb(new Set()),
  );
}

export function setFavorite(uid, peerId, on, peerName = '') {
  const ref = doc(db, 'users', uid, 'favorites', peerId);
  return on
    ? setDoc(ref, { name: String(peerName || '').slice(0, 60), at: serverTimestamp() })
    : deleteDoc(ref);
}

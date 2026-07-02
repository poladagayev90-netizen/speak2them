import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

export function saveWordToHistory(userId, originalWord, translatedWord) {
  if (!userId || !originalWord || !translatedWord) return;
  return addDoc(collection(db, 'wordHistory', userId, 'words'), {
    original: originalWord,
    translated: translatedWord,
    createdAt: serverTimestamp(),
  }).catch(err => console.error('[WordHistory] Save failed:', err));
}

export function subscribeToWordHistory(userId, callback) {
  const q = query(
    collection(db, 'wordHistory', userId, 'words'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const words = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(words);
  });
}

export function deleteWordFromHistory(userId, wordId) {
  return deleteDoc(doc(db, 'wordHistory', userId, 'words', wordId))
    .catch(err => console.error('[WordHistory] Delete failed:', err));
}

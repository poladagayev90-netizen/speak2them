import {
  collection, doc, onSnapshot, setDoc, deleteDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// Play-in UGC siyasəti üçün minimal şikayət + blok təbəqəsi.
//
// Blok modeli: users/{uid}/blocked/{peerId} — sənədin mövcudluğu = blok.
// Sahibindən başqa heç kim oxuya/yaza bilməz (rules). Blok YALNIZ blok edənin
// görünüşünü təmizləyir: siyahılar, söhbətlər, gələn zəng modalı və server
// push-u. Qarşı tərəfə heç nə bildirilmir.
//
// Şikayət modeli: reports/{autoId} — client yalnız CREATE edə bilir, oxumaq
// yalnız adminə açıqdır. Baxış admin panelindən/konsoldan aparılır.

export function subscribeToBlocked(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(
    collection(db, 'users', uid, 'blocked'),
    (snap) => cb(new Set(snap.docs.map((d) => d.id))),
    () => cb(new Set())
  );
}

export function blockUser(uid, peerId, peerName) {
  return setDoc(doc(db, 'users', uid, 'blocked', peerId), {
    name: (peerName || '').slice(0, 60),
    blockedAt: serverTimestamp(),
  });
}

export function unblockUser(uid, peerId) {
  return deleteDoc(doc(db, 'users', uid, 'blocked', peerId));
}

export function submitReport(reporterId, reportedId, reportedName, reason) {
  return addDoc(collection(db, 'reports'), {
    reporterId,
    reportedId,
    reportedName: (reportedName || '').slice(0, 60),
    reason: (reason || '').slice(0, 500),
    createdAt: serverTimestamp(),
    status: 'open',
  });
}

import {
  collection, doc, query, where, orderBy, limit, onSnapshot, setDoc, updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// Çat köməkçiləri. Sənəd id-si HƏMİŞƏ sıralanmış uid cütüdür — rules üzvlüyü
// məhz bu sətirdən çıxarır, ona görə başqa formatda id yaratmaq olmaz.
export const chatIdFor = (a, b) => [a, b].sort().join('_');

export const chatPeerId = (chatId, myUid) => {
  const parts = String(chatId || '').split('_');
  return parts[0] === myUid ? parts[1] : parts[0];
};

export const unreadFor = (chatData, uid) => Number(chatData?.unread?.[uid]) || 0;

// Söhbət siyahısı. orderBy('updatedAt') indeksi firestore.indexes.json-da
// artıq var (participants CONTAINS + updatedAt DESC) — əvvəl sıralama client
// tərəfdə edilirdi, yəni limit(50) ən son deyil, TƏSADÜFİ 50 söhbəti gətirirdi.
export function subscribeToChats(uid, cb) {
  return onSnapshot(
    query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
      limit(50),
    ),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => { console.error('[chats] subscribe', e); cb([]); },
  );
}

// Bütün oxunmamışların cəmi — aşağı naviqasiyadakı nişan üçün.
export function subscribeToUnreadTotal(uid, cb) {
  return subscribeToChats(uid, (chats) => {
    cb(chats.reduce((sum, c) => sum + unreadFor(c, uid), 0));
  });
}

// Söhbət açılanda öz sayğacımı sıfırlayıram. Rules qarşı tərəfinkinə toxunmağa
// icazə vermir, ona görə bu yazı təhlükəsizdir.
export function markChatRead(chatId, uid) {
  return updateDoc(doc(db, 'chats', chatId), { [`unread.${uid}`]: 0 })
    .catch(() => {}); // sənəd hələ yoxdursa (mesaj yazılmayıb) etmək lazım deyil
}

// "Hamı üçün sil" — məzarlıq qeydi qalır (müasir mesajlaşma konvensiyası).
// Sətri tamamilə silmək söhbətin gedişini anlaşılmaz edir.
export function deleteMessage(chatId, messageId) {
  return updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
    deleted: true,
    text: '',
  });
}

// Çat sənədi yalnız İLK MESAJLA yaranır. Əvvəl istifadəçinin profilinə girmək
// kifayət edirdi və siyahı "Hələ mesaj yoxdur" kabus sətirləri ilə dolurdu.
export function touchChat({ chatId, myUid, peerId, lastMessage }) {
  return setDoc(doc(db, 'chats', chatId), {
    participants: [myUid, peerId].sort(),
    updatedAt: serverTimestamp(),
    lastMessage,
    lastSenderId: myUid,
  }, { merge: true });
}

// Siyahıdakı qısa vaxt etiketi: bu gün saat, dünən "Dünən", sonra tarix.
// Ay adları əl ilə: toLocaleDateString bəzi WebView-lərdə "M07" verir.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function chatTimeLabel(ts) {
  const ms = ts?.toMillis?.() || (ts instanceof Date ? ts.getTime() : 0);
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

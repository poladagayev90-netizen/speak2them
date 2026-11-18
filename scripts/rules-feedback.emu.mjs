// Rules check for Profile → Help & feedback (`feedback/{id}`), against the
// Firestore EMULATOR only (never production):
//   npx firebase-tools emulators:exec --config firebase.emu.json --only firestore \
//     "node scripts/rules-feedback.emu.mjs" --project demo-feedback
// Learner may only create their own message; only the admin reads it and may
// only flip `status`.
import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, addDoc, setDoc,
  updateDoc, serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';

const PROJECT = 'demo-feedback';
const ADMIN = '6Djehd9KB8dTZUgVwVJfLoPI5dF3';

function as(uid) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo' }, uid);
  const db = getFirestore(app);
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { user_id: uid } });
  return db;
}
const ok = async (p) => { try { await p; return 'ALLOW'; } catch (e) { return e.code === 'permission-denied' ? 'deny' : `ERR ${e.code}`; } };

const good = (uid) => ({
  uid, type: 'problem', text: 'The call screen froze', appVersion: '1.26', platform: 'web',
  route: '/profile', userAgent: 'test', status: 'new', createdAt: serverTimestamp(),
});

const stu = as('stu');
const other = as('other');
const adm = as(ADMIN);

const cases = [];
const ref = doc(collection(stu, 'feedback'));
cases.push(['owner creates own', await ok(setDoc(ref, good('stu'))), 'ALLOW']);
cases.push(['owner creates with screenshot', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), screenshot: 'data:image/jpeg;base64,AAAA' })), 'ALLOW']);
cases.push(['create for someone else', await ok(addDoc(collection(stu, 'feedback'), good('other'))), 'deny']);
cases.push(['extra field', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), name: 'x' })), 'deny']);
cases.push(['bad type', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), type: 'spam' })), 'deny']);
cases.push(['status done on create', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), status: 'done' })), 'deny']);
cases.push(['empty text', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), text: '' })), 'deny']);
cases.push(['client time', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), createdAt: new Date(0) })), 'deny']);
cases.push(['huge screenshot', await ok(addDoc(collection(stu, 'feedback'), { ...good('stu'), screenshot: 'data:image/jpeg;base64,' + 'A'.repeat(360000) })), 'deny']);
cases.push(['owner reads own', await ok(getDoc(doc(stu, 'feedback', ref.id))), 'deny']);
cases.push(['owner updates own', await ok(updateDoc(doc(stu, 'feedback', ref.id), { text: 'changed' })), 'deny']);
cases.push(['stranger reads', await ok(getDoc(doc(other, 'feedback', ref.id))), 'deny']);
cases.push(['stranger lists', await ok(getDocs(collection(other, 'feedback'))), 'deny']);
cases.push(['admin lists newest first', await ok(getDocs(query(collection(adm, 'feedback'), orderBy('createdAt', 'desc'), limit(60)))), 'ALLOW']);
cases.push(['admin marks done', await ok(updateDoc(doc(adm, 'feedback', ref.id), { status: 'done' })), 'ALLOW']);
cases.push(['admin edits text', await ok(updateDoc(doc(adm, 'feedback', ref.id), { text: 'x' })), 'deny']);

let bad = 0;
for (const [what, got, want] of cases) {
  if (got !== want) bad += 1;
  console.log(`${got === want ? 'ok ' : 'BAD'} ${what.padEnd(30)} ${got}`);
}
console.log(bad ? `${bad} FAILED` : 'all rules behave');
process.exit(bad ? 1 : 0);

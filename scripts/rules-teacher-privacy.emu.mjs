// Rules check for "the teacher sees types, never the conversation", against the
// Firestore EMULATOR only (never production):
//   npx firebase-tools emulators:exec --config firebase.emu.json --only firestore \
//     "node scripts/rules-teacher-privacy.emu.mjs" --project demo-privacy
// Seeds with the Admin SDK, then reads as the student, their teacher and a
// stranger with the web SDK (mock tokens).
import { createRequire } from 'module';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, query, where,
} from 'firebase/firestore';

// firebase-admin lives in functions/node_modules only.
const admin = createRequire(new URL('../functions/', import.meta.url))('firebase-admin');
const PROJECT = 'demo-privacy';
admin.initializeApp({ projectId: PROJECT });
const adb = admin.firestore();

await adb.doc('users/stu').set({ name: 'Stu', teacherId: 'tch' });
await adb.doc('callAnalysis/stu_c1_s1').set({ userId: 'stu', status: 'done', transcript: 'my mother is sick' });
await adb.doc('callAnalysisTeacher/stu_c1_s1').set({ userId: 'stu', status: 'done', teacherView: true, errorThemes: [] });
for (const id of ['grammar', 'progress', 'vocabIndex', 'teacherProgress']) await adb.doc(`users/stu/insights/${id}`).set({ x: 1 });

function as(uid) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo' }, uid);
  const db = getFirestore(app);
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  connectFirestoreEmulator(db, host, Number(port), { mockUserToken: { user_id: uid } });
  return db;
}
const ok = async (p) => { try { await p; return 'ALLOW'; } catch (e) { return e.code === 'permission-denied' ? 'deny' : `ERR ${e.code}`; } };

const cases = [];
for (const who of ['stu', 'tch', 'stranger']) {
  const db = as(who);
  cases.push([who, 'get callAnalysis', await ok(getDoc(doc(db, 'callAnalysis/stu_c1_s1')))]);
  cases.push([who, 'list callAnalysis', await ok(getDocs(query(collection(db, 'callAnalysis'), where('userId', '==', 'stu'))))]);
  cases.push([who, 'list callAnalysisTeacher', await ok(getDocs(query(collection(db, 'callAnalysisTeacher'), where('userId', '==', 'stu'))))]);
  for (const id of ['grammar', 'teacherProgress', 'progress', 'vocabIndex']) {
    cases.push([who, `get insights/${id}`, await ok(getDoc(doc(db, `users/stu/insights/${id}`)))]);
  }
}
const expected = {
  stu: 'ALLOW', // the learner reads everything of their own
  tch: { 'get callAnalysis': 'deny', 'list callAnalysis': 'deny', 'list callAnalysisTeacher': 'ALLOW', 'get insights/grammar': 'ALLOW', 'get insights/teacherProgress': 'ALLOW', 'get insights/progress': 'deny', 'get insights/vocabIndex': 'deny' },
  stranger: 'deny',
};
let bad = 0;
for (const [who, what, got] of cases) {
  const want = typeof expected[who] === 'string' ? expected[who] : expected[who][what];
  if (got !== want) bad += 1;
  console.log(`${got === want ? 'ok ' : 'BAD'} ${who.padEnd(8)} ${what.padEnd(28)} ${got}`);
}
console.log(bad ? `${bad} FAILED` : 'all rules behave');
process.exit(bad ? 1 : 0);

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// The ticket is the only record the worker acts on. If this write is lost, the
// recording sits in Storage forever and the user waits for a result that will
// never come — so a transient network failure must not be the end of it.
async function withRetry(label, fn, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`[AnalysisQueue] ${label} attempt ${i}/${attempts} failed:`, error.message);
      if (i < attempts) await new Promise((r) => setTimeout(r, 500 * 2 ** (i - 1)));
    }
  }
  throw lastError;
}

// Creates the analysis ticket + the "queued" status doc after the recording
// upload. The scheduled worker claims tickets from analysisQueue and writes
// the finished analysis into callAnalysis/{same id}.
//
// Order matters: the ticket first. Writing the "queued" doc first would leave a
// user staring at a queued screen for a job nobody will ever run.
export async function enqueueCallAnalysis({ uid, callDocId, sessionId, storagePath, audioSeconds, callSeconds, peerName }) {
  const docId = `${uid}_${callDocId}_${sessionId}`;

  // Rules `audioSeconds <= callSeconds` tələb edir. Nəzəri olaraq bu onsuz da
  // doğrudur, amma iki müddət iki ayrı mənbədən gəlir (audio saatı vs divar
  // saatı) və yuvarlaqlaşma bir saniyəlik fərq yarada bilər. Sıxmasaq həmin
  // nadir hal ticket-i tamamilə rədd etdirər və analiz heç vaxt gəlməz.
  const callSec = Math.min(Math.max(1, Math.round(callSeconds || audioSeconds)), 3600);
  const audioSec = Math.min(Math.max(1, Math.round(audioSeconds)), callSec);

  await withRetry('ticket write', () => setDoc(doc(db, 'analysisQueue', docId), {
    status: 'pending',
    storagePath,
    // Yüklənən FAYLIN uzunluğu (sükut kəsildikdən sonra). Worker-in saatlıq
    // audio büdcəsi və qismən-analiz bayt-prefiksi buna bölür — ona görə bu
    // rəqəm zəngin uzunluğu deyil, faylın uzunluğu olmalıdır.
    // Tavan firestore.rules-dakı `audioSeconds <= 3600` ilə SİNXRON olmalıdır.
    // 1800 idi: 1 saatlıq zəng 30 dəq kimi yazılırdı və analiz nisbəti səhv
    // hesablanırdı.
    audioSeconds: audioSec,
    // Zəngin divar saatı ilə müddəti — yalnız istifadəçiyə göstərmək üçün
    // (History, müəllim paneli). Sükut kəsmədən sonra audioSeconds bundan
    // xeyli kiçik olur, ona görə ikisi ayrı daşınır.
    callSeconds: callSec,
    uid,
    callDocId,
    sessionId: String(sessionId),
    peerName: peerName || null,
    retryCount: 0,
    createdAt: serverTimestamp(),
  }));

  await withRetry('queued marker', () => setDoc(doc(db, 'callAnalysis', docId), {
    status: 'queued',
    userId: uid,
    timestamp: serverTimestamp(),
  }));

  console.log('[AnalysisQueue] Ticket created:', docId);
  return docId;
}

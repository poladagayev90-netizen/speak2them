import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Creates the analysis ticket + the "queued" status doc after the recording
// upload. The scheduled worker claims tickets from analysisQueue and writes
// the finished analysis into callAnalysis/{same id}.
export async function enqueueCallAnalysis({ uid, callDocId, sessionId, storagePath, audioSeconds, peerName }) {
  const docId = `${uid}_${callDocId}_${sessionId}`;

  await setDoc(doc(db, 'analysisQueue', docId), {
    status: 'pending',
    storagePath,
    // Used only for the worker's hourly audio budget; the full file is
    // analyzed regardless. Clamped to the 1800s cap enforced by rules.
    audioSeconds: Math.min(Math.max(1, Math.round(audioSeconds)), 1800),
    uid,
    callDocId,
    sessionId: String(sessionId),
    peerName: peerName || null,
    retryCount: 0,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'callAnalysis', docId), {
    status: 'queued',
    userId: uid,
    timestamp: serverTimestamp(),
  });

  console.log('[AnalysisQueue] Ticket created:', docId);
  return docId;
}

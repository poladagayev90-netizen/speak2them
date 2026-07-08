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
export async function enqueueCallAnalysis({ uid, callDocId, sessionId, storagePath, audioSeconds, peerName }) {
  const docId = `${uid}_${callDocId}_${sessionId}`;

  await withRetry('ticket write', () => setDoc(doc(db, 'analysisQueue', docId), {
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
  }));

  await withRetry('queued marker', () => setDoc(doc(db, 'callAnalysis', docId), {
    status: 'queued',
    userId: uid,
    timestamp: serverTimestamp(),
  }));

  console.log('[AnalysisQueue] Ticket created:', docId);
  return docId;
}

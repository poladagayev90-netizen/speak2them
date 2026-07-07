import {
  collection,
  doc,
  deleteDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export const MATCH_STATUS = {
  SEARCHING: 'searching',
  MATCHED: 'matched',
  // Parked for the scheduled evening session; paired server-side by the
  // matchSessionQueue function, invisible to on-demand searchers.
  WAITING_SESSION: 'waiting_session',
  UNMATCHED: 'unmatched',
};

const LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

export const getLevelCode = (level = '') => {
  const match = String(level).match(/^(A1|A2|B1|B2|C1|C2)\b/);
  return match ? match[1] : null;
};

const getLevelRank = (level) => {
  const code = getLevelCode(level);
  return code !== null ? LEVEL_RANK[code] : null;
};

export const getMatchCallId = (uidA, uidB) => `call_${[uidA, uidB].sort().join('_')}`;



const scoreCandidate = (candidate, currentUser) => {
  const rankA = getLevelRank(currentUser.level);
  const rankB = getLevelRank(candidate.level);
  const distance = (rankA !== null && rankB !== null) ? Math.abs(rankA - rankB) : 3;
  const distanceScore = Math.max(0, 50 - distance * 15);
  const joinedAt = candidate.joinedAt?.toMillis?.() || candidate.joinedAtMs || 0;
  const waitBonus = joinedAt ? Math.min(20, Math.floor((Date.now() - joinedAt) / 30000)) : 0;
  // Shared survey interests — same weighting the server-side session pairing uses.
  const myTopics = Array.isArray(currentUser.topics) ? currentUser.topics : [];
  const theirTopics = Array.isArray(candidate.topics) ? candidate.topics : [];
  const topicBonus = myTopics.filter((t) => theirTopics.includes(t)).length * 10;
  return distanceScore + waitBonus + topicBonus;
};

export function pickBestMatch(candidates, currentUser) {
  const pool = candidates.filter((c) => c.uid && c.uid !== currentUser.uid);
  if (pool.length === 0) return null;

  // Deterministic role: only the lexicographically SMALLER uid initiates matching
  // The larger uid just waits — this prevents race conditions completely
  const eligibleCandidates = pool.filter((c) => {
    if (currentUser.uid >= c.uid) return false;
    // Exclude offline "ghosts" who closed the app abruptly while searching
    const joinedAt = c.joinedAtMs || c.joinedAt?.toMillis?.() || 0;
    if (Date.now() - joinedAt > 20000) return false; 
    return true;
  });
  if (eligibleCandidates.length === 0) return null;

  return [...eligibleCandidates].sort(
    (a, b) => scoreCandidate(b, currentUser) - scoreCandidate(a, currentUser)
  )[0];
}

export async function joinSearchQueue(entry) {
  await setDoc(doc(db, 'matchQueue', entry.uid), {
    ...entry,
    status: MATCH_STATUS.SEARCHING,
  }, { merge: true });
}

export async function joinSessionQueue(entry) {
  await setDoc(doc(db, 'matchQueue', entry.uid), {
    ...entry,
    status: MATCH_STATUS.WAITING_SESSION,
  }, { merge: true });
}

// Liveness ping while parked for a session; the server-side pairing skips
// tickets whose last ping is stale (user closed the app while waiting).
export async function pingSessionQueue(uid) {
  try {
    await setDoc(doc(db, 'matchQueue', uid), { lastPingMs: Date.now() }, { merge: true });
  } catch (e) { /* transient — next ping retries */ }
}

export async function leaveSearchQueue(uid) {
  try {
    await deleteDoc(doc(db, 'matchQueue', uid));
  } catch (e) { /* already removed */ }
}

export async function commitMatch(myUid, partnerUid) {
  if (!myUid || !partnerUid || myUid === partnerUid) return null;
  // Safety check: only smaller UID should call this
  if (myUid >= partnerUid) return null;

  const myRef = doc(db, 'matchQueue', myUid);
  const partnerRef = doc(db, 'matchQueue', partnerUid);
  const callId = getMatchCallId(myUid, partnerUid);
  const callRef = doc(db, 'calls', callId);

  try {
    await runTransaction(db, async (transaction) => {
      const mySnap = await transaction.get(myRef);
      const partnerSnap = await transaction.get(partnerRef);

      if (!mySnap.exists() || mySnap.data().status !== MATCH_STATUS.SEARCHING) {
        throw new Error('self-not-searching');
      }
      if (!partnerSnap.exists() || partnerSnap.data().status !== MATCH_STATUS.SEARCHING) {
        throw new Error('partner-not-searching');
      }

      const myData = mySnap.data();
      const partnerData = partnerSnap.data();

      transaction.set(callRef, {
        userA: myUid,
        userB: partnerUid,
        callerId: myUid,
        callerName: myData.name || 'User',
        receiverName: partnerData.name || 'User',
        receiverId: partnerUid,
        status: 'accepted',
        source: 'random_match',
        createdAt: serverTimestamp(),
        matchedAt: serverTimestamp(),
      }, { merge: true });

      transaction.update(myRef, {
        status: MATCH_STATUS.MATCHED,
        matchedWith: partnerUid,
        callId,
        matchedAt: serverTimestamp(),
      });
      transaction.update(partnerRef, {
        status: MATCH_STATUS.MATCHED,
        matchedWith: myUid,
        callId,
        matchedAt: serverTimestamp(),
      });
    });
    return { matchedWith: partnerUid, callId };
  } catch (e) {
    console.warn('[commitMatch] failed:', e.message);
    return null;
  }
}

export function subscribeToOwnQueue(uid, onUpdate) {
  return onSnapshot(doc(db, 'matchQueue', uid), (snap) => {
    onUpdate(snap.exists() ? snap.data() : null);
  });
}

export function subscribeToSearchingQueue(onCandidates) {
  // Cap the fan-out: every searcher streams this set, so at high load an
  // unbounded query would cost O(N) reads per searcher.
  const q = query(
    collection(db, 'matchQueue'),
    where('status', '==', MATCH_STATUS.SEARCHING),
    limit(25)
  );
  return onSnapshot(q, (snap) => {
    onCandidates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

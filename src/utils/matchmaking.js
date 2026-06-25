import {
  collection,
  doc,
  deleteDoc,
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
};

const LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

const getLevelCode = (level = '') => {
  const match = String(level).match(/^(A1|A2|B1|B2|C1|C2)\b/);
  return match ? match[1] : null;
};

const getLevelRank = (level) => {
  const code = getLevelCode(level);
  return code ? LEVEL_RANK[code] : null;
};

const levelDistance = (a, b) => {
  const rankA = getLevelRank(a);
  const rankB = getLevelRank(b);
  if (rankA === null || rankB === null) return 99;
  return Math.abs(rankA - rankB);
};

export const getMatchCallId = (uidA, uidB) => `call_${[uidA, uidB].sort().join('_')}`;

const queueJoinedAt = (entry = {}) => {
  if (typeof entry.joinedAtMs === 'number') return entry.joinedAtMs;
  return entry.joinedAt?.toMillis?.() || 0;
};

const isLaterQueueEntry = (mine, partner, myUid, partnerUid) => {
  const myJoinedAt = queueJoinedAt(mine);
  const partnerJoinedAt = queueJoinedAt(partner);

  if (myJoinedAt !== partnerJoinedAt) {
    return myJoinedAt > partnerJoinedAt;
  }

  return myUid > partnerUid;
};

const targetAllowsLevel = (targetLevel, candidateLevel) => {
  if (!targetLevel || targetLevel === 'All' || targetLevel === 'Any') return true;
  return getLevelCode(targetLevel) === getLevelCode(candidateLevel);
};



const scoreCandidate = (candidate, currentUser, requestedLevel) => {
  const distance = levelDistance(currentUser.level, candidate.level);
  const distanceScore = distance === 99 ? 5 : Math.max(0, 80 - distance * 25);
  const exactRequestedBonus = requestedLevel !== 'All' && targetAllowsLevel(requestedLevel, candidate.level) ? 35 : 0;
  const mutualTargetBonus = targetAllowsLevel(candidate.desiredLevel, currentUser.level) ? 20 : 0;
  const joinedAt = candidate.joinedAt?.toMillis?.() || 0;
  const waitBonus = joinedAt ? Math.min(15, Math.floor((Date.now() - joinedAt) / 60000)) : 0;

  return distanceScore + exactRequestedBonus + mutualTargetBonus + waitBonus;
};

export function pickBestMatch(candidates, currentUser, requestedLevel, useLevelMatching) {
  const pool = candidates.filter((c) => c.uid && c.uid !== currentUser.uid);
  if (pool.length === 0) return null;

  // Under 20 searching users — match with anyone
  if (!useLevelMatching) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Neighbor level map — each level can match with adjacent levels
  const ALLOWED_NEIGHBORS = {
    A1: ['A1', 'A2'],
    A2: ['A1', 'A2', 'B1'],
    B1: ['A2', 'B1', 'B2'],
    B2: ['B1', 'B2', 'C1'],
    C1: ['B1', 'B2', 'C1', 'C2'],
    C2: ['C1', 'C2'],
  };

  const myCode = getLevelCode(currentUser.level);
  const allowedForMe = myCode ? (ALLOWED_NEIGHBORS[myCode] || [myCode]) : null;

  const neighborMatches = allowedForMe
    ? pool.filter((c) => {
        const cCode = getLevelCode(c.level);
        const allowedForCandidate = cCode ? (ALLOWED_NEIGHBORS[cCode] || [cCode]) : null;
        // Both must accept each other's level
        return (
          allowedForMe.includes(cCode) &&
          (allowedForCandidate ? allowedForCandidate.includes(myCode) : true)
        );
      })
    : pool;

  const finalPool = neighborMatches.length > 0 ? neighborMatches : pool;

  return [...finalPool].sort(
    (a, b) => scoreCandidate(b, currentUser, requestedLevel) - scoreCandidate(a, currentUser, requestedLevel)
  )[0];
}

export async function joinSearchQueue(entry) {
  await setDoc(doc(db, 'matchQueue', entry.uid), entry, { merge: true });
}

export async function leaveSearchQueue(uid) {
  try {
    await deleteDoc(doc(db, 'matchQueue', uid));
  } catch (e) {
    // already removed
  }
}

export async function commitMatch(myUid, partnerUid) {
  if (!myUid || !partnerUid || myUid === partnerUid) return null;

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

      if (!isLaterQueueEntry(myData, partnerData, myUid, partnerUid)) {
        throw new Error('not-later-queue-entry');
      }

      transaction.set(callRef, {
        userA: myUid,
        userB: partnerUid,
        callerId: myUid,
        callerName: myData.name || 'User',
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
  } catch {
    return null;
  }
}

export function subscribeToOwnQueue(uid, onUpdate) {
  return onSnapshot(doc(db, 'matchQueue', uid), (snap) => {
    onUpdate(snap.exists() ? snap.data() : null);
  });
}

export function subscribeToSearchingQueue(onCandidates) {
  const q = query(
    collection(db, 'matchQueue'),
    where('status', '==', MATCH_STATUS.SEARCHING)
  );
  return onSnapshot(q, (snap) => {
    onCandidates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

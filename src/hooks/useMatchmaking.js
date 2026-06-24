import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
  MATCH_STATUS,
  commitMatch,
  joinSearchQueue,
  leaveSearchQueue,
  pickBestMatch,
  subscribeToOwnQueue,
  subscribeToSearchingQueue,
} from '../utils/matchmaking';

const LEVEL_MATCHING_MIN_SEARCHING_USERS = 50;
const SEARCH_TIMEOUT_MS = 15000;
const COMPENSATION_MINUTES = 5;

export function useMatchmaking({
  user,
  levelFilter,
  onMatched,
}) {
  const [searching, setSearching] = useState(false);
  const [compensationMsg, setCompensationMsg] = useState('');
  const searchingRef = useRef(false);
  const matchingRef = useRef(false);
  const ownUnsubRef = useRef(null);
  const queueUnsubRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    searchingRef.current = searching;
  }, [searching]);

  const userLevel = user.level || 'Any';
  const userName = user.displayName || user.name || 'User';
  const userPartnerPreference = user.partnerPreference || 'Any';

  const cleanupListeners = useCallback(() => {
    if (ownUnsubRef.current) {
      ownUnsubRef.current();
      ownUnsubRef.current = null;
    }
    if (queueUnsubRef.current) {
      queueUnsubRef.current();
      queueUnsubRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const tryMatchWithCandidates = useCallback(async (candidates) => {
    if (!searchingRef.current || matchingRef.current || !user.uid) return;

    const searchingCount = candidates.filter((candidate) => (
      candidate.status === MATCH_STATUS.SEARCHING
    )).length;
    const useLevelMatching = searchingCount >= LEVEL_MATCHING_MIN_SEARCHING_USERS;

    const best = pickBestMatch(
      candidates,
      { uid: user.uid, level: userLevel, partnerPreference: userPartnerPreference },
      levelFilter,
      useLevelMatching
    );
    if (!best?.uid) return;

    matchingRef.current = true;
    await commitMatch(user.uid, best.uid);
    matchingRef.current = false;
  }, [
    user.uid,
    userLevel,
    userPartnerPreference,
    levelFilter,
  ]);

  const giveCompensation = useCallback(async () => {
  if (!user.uid) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const currentBonus = userSnap.exists() ? (userSnap.data().bonusMinutes || 0) : 0;
    await setDoc(userRef, {
      bonusMinutes: currentBonus + COMPENSATION_MINUTES,
    }, { merge: true });
    setCompensationMsg(`Partnyor tapılmadı, ${COMPENSATION_MINUTES} dəqiqə hədiyyə edildi!`);
    setTimeout(() => setCompensationMsg(''), 5000);
  } catch (e) {
    console.error('[Matchmaking] Compensation write error:', e);
  }
}, [user.uid]);

  const cancelSearch = useCallback(async () => {
    setSearching(false);
    matchingRef.current = false;
    cleanupListeners();
    await leaveSearchQueue(user.uid);
  }, [cleanupListeners, user.uid]);

  const startSearch = useCallback(async () => {
    if (!user.uid) return;
    if (searching) {
      await cancelSearch();
      return;
    }

    setSearching(true);
    matchingRef.current = false;

    await joinSearchQueue({
      uid: user.uid,
      name: userName,
      level: userLevel,
      desiredLevel: levelFilter || 'Any',
      partnerPreference: userPartnerPreference,
      status: MATCH_STATUS.SEARCHING,
      joinedAtMs: Date.now(),
      joinedAt: serverTimestamp(),
    });

    queueUnsubRef.current = subscribeToSearchingQueue((candidates) => {
      tryMatchWithCandidates(candidates);
    });

    ownUnsubRef.current = subscribeToOwnQueue(user.uid, async (data) => {
      if (data?.status === MATCH_STATUS.MATCHED && data.matchedWith) {
        cleanupListeners();
        setSearching(false);
        await leaveSearchQueue(user.uid);
        onMatched(data.matchedWith, data.callId);
      }
    });

    // 15-saniyəlik timeout — partner tapılmasa kompensasiya ver
    timeoutRef.current = setTimeout(async () => {
      if (searchingRef.current) {
        await giveCompensation();
        setSearching(false);
        matchingRef.current = false;
        cleanupListeners();
        await leaveSearchQueue(user.uid);
      }
    }, SEARCH_TIMEOUT_MS);
  }, [
    user.uid,
    searching,
    cancelSearch,
    userName,
    userLevel,
    levelFilter,
    userPartnerPreference,
    tryMatchWithCandidates,
    cleanupListeners,
    onMatched,
    giveCompensation,
  ]);

  useEffect(() => () => {
    cleanupListeners();
    if (searchingRef.current) {
      leaveSearchQueue(user.uid);
    }
  }, [cleanupListeners, user.uid]);

  return { searching, startSearch, cancelSearch, compensationMsg };
}

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

const LEVEL_MATCHING_MIN_USERS = 10;
const SEARCH_TIMEOUT_MS = 15000;
const COMPENSATION_MINUTES = 5;

export function useMatchmaking({
  user,
  levelFilter,
  totalUsers,
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
  const useLevelMatching = totalUsers >= LEVEL_MATCHING_MIN_USERS;

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

    const best = pickBestMatch(
      candidates,
      { uid: user.uid, level: userLevel, partnerPreference: userPartnerPreference },
      levelFilter,
      useLevelMatching
    );
    if (!best?.uid) return;

    matchingRef.current = true;
    const matched = await commitMatch(user.uid, best.uid);
    matchingRef.current = false;

    if (matched) {
      cleanupListeners();
      setSearching(false);
      onMatched(best.uid);
    }
  }, [
    user.uid,
    userLevel,
    userPartnerPreference,
    levelFilter,
    useLevelMatching,
    cleanupListeners,
    onMatched,
  ]);

  const giveCompensation = useCallback(async () => {
    if (!user.uid) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentBalance = userSnap.exists() ? (userSnap.data().minutesBalance || 0) : 0;
      await setDoc(userRef, {
        minutesBalance: currentBalance + COMPENSATION_MINUTES,
      }, { merge: true });
      setCompensationMsg('Partnyor tapılmadı, 5 dəqiqə hədiyyə edildi!');
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
      desiredLevel: useLevelMatching ? levelFilter : 'Any',
      partnerPreference: useLevelMatching ? userPartnerPreference : 'Any',
      status: MATCH_STATUS.SEARCHING,
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
        onMatched(data.matchedWith);
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
    useLevelMatching,
    userPartnerPreference,
    tryMatchWithCandidates,
    cleanupListeners,
    onMatched,
    giveCompensation,
  ]);

  useEffect(() => () => {
    cleanupListeners();
  }, [cleanupListeners]);

  return { searching, startSearch, cancelSearch, compensationMsg };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
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

export function useMatchmaking({
  user,
  levelFilter,
  totalUsers,
  onMatched,
}) {
  const [searching, setSearching] = useState(false);
  const searchingRef = useRef(false);
  const matchingRef = useRef(false);
  const ownUnsubRef = useRef(null);
  const queueUnsubRef = useRef(null);

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
  ]);

  useEffect(() => () => {
    cleanupListeners();
  }, [cleanupListeners]);

  return { searching, startSearch, cancelSearch };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import {
  MATCH_STATUS,
  SEARCH_PING_INTERVAL_MS,
  commitMatch,
  joinSearchQueue,
  leaveSearchQueue,
  pickBestMatch,
  pingSearchQueue,
  subscribeToOwnQueue,
  subscribeToSearchingQueue,
} from '../utils/matchmaking';

// With a small user base the odds of two people searching inside the same
// 30-second window are poor, and a premature give-up reads as "the app is
// broken". Two minutes costs one queue doc and a listener.
const SEARCH_TIMEOUT_MS = 120000;

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
  const pingIntervalRef = useRef(null);

  useEffect(() => {
    searchingRef.current = searching;
  }, [searching]);

  const userLevel = user.level || 'Any';
  const userName = user.displayName || user.name || 'User';

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
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const tryMatchWithCandidates = useCallback(async (candidates) => {
    if (!searchingRef.current || matchingRef.current || !user.uid) return;

    const best = pickBestMatch(
      candidates,
      { uid: user.uid, level: userLevel, topics: user.topics }
    );
    if (!best?.uid) return;

    matchingRef.current = true;
    try {
      await commitMatch(user.uid, best.uid);
    } finally {
      matchingRef.current = false; // ALWAYS reset, even on failure
    }
  }, [user.uid, userLevel, user.topics]);

  // No minute compensation anymore (Free/Premium model) — the consolation is
  // the AInur fallback CTA the message drives.
  const showNoMatchFallback = useCallback(() => {
    setCompensationMsg('Partnyor tapılmadı. İstərsəniz AInur ilə (Süni İntellekt) dərhal praktika edə bilərsiniz!');
    setTimeout(() => setCompensationMsg(''), 10000);
  }, []);

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
      topics: Array.isArray(user.topics) ? user.topics.slice(0, 3) : [],
      partnerPreference: user.partnerPreference || 'Any',
      status: MATCH_STATUS.SEARCHING,
      joinedAtMs: Date.now(),
      lastPingMs: Date.now(),
      joinedAt: serverTimestamp(),
    });

    // Proof of life for peers scoring us — without it we look like a ghost.
    pingIntervalRef.current = setInterval(() => {
      if (searchingRef.current) pingSearchQueue(user.uid);
    }, SEARCH_PING_INTERVAL_MS);

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

    // Axtarış timeout-u — partner tapılmasa AInur fallback-ı göstər
    timeoutRef.current = setTimeout(async () => {
      if (searchingRef.current) {
        showNoMatchFallback();
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
    user.topics,
    user.partnerPreference,
    tryMatchWithCandidates,
    cleanupListeners,
    onMatched,
    showNoMatchFallback,
  ]);

  useEffect(() => () => {
    cleanupListeners();
    if (searchingRef.current) {
      leaveSearchQueue(user.uid);
    }
  }, [cleanupListeners, user.uid]);

  return { searching, startSearch, cancelSearch, compensationMsg };
}

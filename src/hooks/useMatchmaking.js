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

// Canlı axtarış artıq 2 dəqiqə deyil, 60 saniyədir. Səbəb: uzun gözləmə heç nə
// qazandırmır — həmin dəqiqədə başqası axtarmırsa, bir dəqiqə də axtarmayacaq.
// Vaxt bitəndə istifadəçi boş ekranda qalmır: niyyəti cari blokun slotuna
// YAZILIR (onNoMatch), yəni 5 dəqiqə sonra gələn adam onu görüb qoşula bilir.
// Əvvəl bilet sadəcə silinirdi və niyyətdən heç bir iz qalmırdı.
const SEARCH_TIMEOUT_MS = 60000;

export function useMatchmaking({
  user,
  levelFilter,
  onMatched,
  onNoMatch,
}) {
  const [searching, setSearching] = useState(false);
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

    // Vaxt bitdi — niyyəti itirmirik, slota yazırıq (bax yuxarıdakı şərh).
    timeoutRef.current = setTimeout(async () => {
      if (searchingRef.current) {
        setSearching(false);
        matchingRef.current = false;
        cleanupListeners();
        await leaveSearchQueue(user.uid);
        if (onNoMatch) onNoMatch();
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
    onNoMatch,
  ]);

  useEffect(() => () => {
    cleanupListeners();
    if (searchingRef.current) {
      leaveSearchQueue(user.uid);
    }
  }, [cleanupListeners, user.uid]);

  return { searching, startSearch, cancelSearch };
}

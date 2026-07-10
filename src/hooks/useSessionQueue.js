import { useCallback, useEffect, useRef, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import {
  MATCH_STATUS,
  SEARCH_PING_INTERVAL_MS,
  commitMatch,
  joinSessionQueue,
  leaveSearchQueue,
  pickBestMatch,
  pingSessionQueue,
  subscribeToOwnQueue,
  subscribeToSearchingQueue,
} from '../utils/matchmaking';

// Session mode: the user joins the shared instant `searching` pool with a
// sessionId tag and pairs client-side within seconds, exactly like the
// on-demand path (snapshot → pickBestMatch → smaller uid commits). The server
// cron is only a fallback pairer and the close-of-window settler — a lone
// waiter stays queued until the window closes, then gets the consolation
// bonus (no 2-minute give-up here, unlike useMatchmaking).
export function useSessionQueue({ user, onMatched }) {
  const [joined, setJoined] = useState(false);
  const [unmatchedMsg, setUnmatchedMsg] = useState('');
  const unsubRef = useRef(null);
  const queueUnsubRef = useRef(null);
  const joinedRef = useRef(false);
  const matchingRef = useRef(false);
  const pingIntervalRef = useRef(null);

  const cleanup = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (queueUnsubRef.current) {
      queueUnsubRef.current();
      queueUnsubRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const leaveSession = useCallback(async () => {
    joinedRef.current = false;
    setJoined(false);
    cleanup();
    await leaveSearchQueue(user.uid);
  }, [cleanup, user.uid]);

  // topicsOverride: freshly picked interests (TopicPickerModal) that may not
  // be on the user prop yet.
  const joinSession = useCallback(async (sessionId, topicsOverride) => {
    if (!user.uid || joinedRef.current) return;
    joinedRef.current = true;
    matchingRef.current = false;
    setJoined(true);
    setUnmatchedMsg('');

    const topics = Array.isArray(topicsOverride) ? topicsOverride : user.topics;
    const myTopics = Array.isArray(topics) ? topics.slice(0, 3) : [];
    await joinSessionQueue({
      uid: user.uid,
      name: user.displayName || user.name || 'User',
      level: user.level || 'Any',
      topics: myTopics,
      partnerPreference: user.partnerPreference || 'Any',
      sessionId,
      joinedAtMs: Date.now(),
      lastPingMs: Date.now(),
      joinedAt: serverTimestamp(),
    });

    // Proof of life at the searching cadence: candidates drop anyone whose
    // ping is older than 60s, so the old 90s session ping made every session
    // waiter look like a ghost to the instant pool.
    pingIntervalRef.current = setInterval(() => {
      if (joinedRef.current) pingSessionQueue(user.uid);
    }, SEARCH_PING_INTERVAL_MS);

    // Instant pairing: same mechanism as useMatchmaking. The smaller uid
    // initiates; commitMatch validates both tickets in a transaction.
    queueUnsubRef.current = subscribeToSearchingQueue(async (candidates) => {
      if (!joinedRef.current || matchingRef.current) return;
      const best = pickBestMatch(
        candidates,
        { uid: user.uid, level: user.level || 'Any', topics: myTopics }
      );
      if (!best?.uid) return;
      matchingRef.current = true;
      try {
        await commitMatch(user.uid, best.uid);
      } finally {
        matchingRef.current = false;
      }
    });

    unsubRef.current = subscribeToOwnQueue(user.uid, async (data) => {
      if (!joinedRef.current || !data) return;
      if (data.status === MATCH_STATUS.MATCHED && data.matchedWith) {
        joinedRef.current = false;
        setJoined(false);
        cleanup();
        await leaveSearchQueue(user.uid);
        onMatched(data.matchedWith, data.callId);
      } else if (data.status === MATCH_STATUS.UNMATCHED) {
        joinedRef.current = false;
        setJoined(false);
        cleanup();
        setUnmatchedMsg('Bu sessiyada tərəfdaş tapılmadı — 5 bonus dəqiqə hesabına əlavə olundu. İstərsən AInur ilə dərhal praktika et!');
        await leaveSearchQueue(user.uid);
      }
    });
  }, [user, cleanup, onMatched]);

  useEffect(() => () => {
    cleanup();
    if (joinedRef.current) {
      leaveSearchQueue(user.uid);
    }
  }, [cleanup, user.uid]);

  return { joined, joinSession, leaveSession, unmatchedMsg };
}

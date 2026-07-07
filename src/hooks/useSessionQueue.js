import { useCallback, useEffect, useRef, useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import {
  MATCH_STATUS,
  joinSessionQueue,
  leaveSearchQueue,
  subscribeToOwnQueue,
} from '../utils/matchmaking';

// Session mode: the user parks a ticket in matchQueue and only listens to
// their own doc — pairing happens server-side (matchSessionQueue) when the
// buffer window closes. No candidate fan-out, no client transactions.
export function useSessionQueue({ user, onMatched }) {
  const [joined, setJoined] = useState(false);
  const [unmatchedMsg, setUnmatchedMsg] = useState('');
  const unsubRef = useRef(null);
  const joinedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  }, []);

  const leaveSession = useCallback(async () => {
    joinedRef.current = false;
    setJoined(false);
    cleanup();
    await leaveSearchQueue(user.uid);
  }, [cleanup, user.uid]);

  const joinSession = useCallback(async (sessionId) => {
    if (!user.uid || joinedRef.current) return;
    joinedRef.current = true;
    setJoined(true);
    setUnmatchedMsg('');

    await joinSessionQueue({
      uid: user.uid,
      name: user.displayName || user.name || 'User',
      level: user.level || 'Any',
      topics: Array.isArray(user.topics) ? user.topics.slice(0, 3) : [],
      partnerPreference: user.partnerPreference || 'Any',
      sessionId,
      joinedAtMs: Date.now(),
      joinedAt: serverTimestamp(),
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

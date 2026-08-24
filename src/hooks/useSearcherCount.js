import { useEffect, useState } from 'react';
import { subscribeToSearchingQueue, SEARCH_STALE_MS, lastAliveMs } from '../utils/matchmaking';

// How many people are looking for a partner RIGHT NOW, for the badge on the
// Live tab.
//
// Why this exists separately from useLiveLobby: the nav bar renders on every
// screen and must not run the whole lobby (presence polling, slots, the
// matchmaking ticket) just to show a number. This is the one subscription it
// needs. It is the same query useLiveLobby already opens, and the Firestore SDK
// shares the underlying listener between identical queries, so on the Live page
// the two cost one stream, not two.
//
// A ticket goes stale rather than being deleted when someone closes the app, so
// the count is re-filtered on a timer — otherwise the badge would keep
// advertising people who left.
export default function useSearcherCount(myUid) {
  const [raw, setRaw] = useState([]);
  const [, setTick] = useState(0);

  useEffect(() => subscribeToSearchingQueue(setRaw), []);

  useEffect(() => {
    if (raw.length === 0) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [raw.length]);

  const now = Date.now();
  return raw.filter((t) => t.uid
    && t.uid !== myUid
    && !t.sessionId
    && now - lastAliveMs(t) <= SEARCH_STALE_MS).length;
}

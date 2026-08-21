import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useMatchmaking } from './useMatchmaking';
import { subscribeToSearchingQueue, SEARCH_STALE_MS, lastAliveMs } from '../utils/matchmaking';
import { subscribeToBlocked } from '../utils/blocklist';
import { getPresence, ONLINE_WINDOW_MS } from '../utils/presence';
import { ADMIN_UID } from '../constants';
import {
  currentBlockSlotId, joinPracticeSlot, leavePracticeSlot,
  subscribeToMySlots, subscribeToSlotChange,
} from '../utils/practiceSlots';

// Everything about finding a person to talk to: who is online, who is searching
// right now, the matchmaking ticket, and your own practice slots.
//
// This used to live inside Home, which is why Home could not be split — the
// home screen and the live lobby shared one 654-line component. Today needs the
// online COUNT and your upcoming call; Live needs all of it. One hook, two
// pages, no duplicated subscriptions.
export function useLiveLobby(user) {
  const navigate = useNavigate();

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [blockedIds, setBlockedIds] = useState(() => new Set());
  const [rawSearchers, setRawSearchers] = useState([]);
  // Value unused — bumping it only forces the staleness re-filter below.
  const [, setSearcherTick] = useState(0);
  const [levelFilter, setLevelFilter] = useState('All');
  const [mine, setMine] = useState(null);
  const [slotChange, setSlotChange] = useState(null);
  const [slotToast, setSlotToast] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [boardOpenSignal, setBoardOpenSignal] = useState(0);

  useEffect(() => subscribeToBlocked(user.uid, setBlockedIds), [user.uid]);

  // Appointment / my slots / the polite reminder all live on my own user doc.
  // They cannot go in App.js's live-field list: objects and arrays never pass a
  // `!==` comparison, so every heartbeat would re-render the whole app.
  useEffect(() => subscribeToMySlots(user.uid, setMine), [user.uid]);
  useEffect(() => subscribeToSlotChange(user.uid, setSlotChange), [user.uid]);

  // Polled rather than a live listener: with a live query every user's presence
  // heartbeat would be re-streamed to every viewer (read amplification). 20s
  // makes an exit visible fast — goOffline stamps status:'offline' instantly,
  // and the poll is the only remaining latency.
  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('lastSeen', '>', cutoff),
          limit(50),
        ));
        if (cancelled) return;
        const now = Date.now();
        const online = [];
        const all = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const u = { id: d.id, ...data, uid: data.uid || d.id };
          if (u.uid === user.uid || u.id === user.uid) return;
          all.push(u);
          // getPresence respects status:'offline', so someone who just left
          // drops off on the next poll rather than after the whole window.
          if (getPresence(u, now) !== 'offline' || u.uid === ADMIN_UID) online.push(u);
        });
        // Free people first — someone already in a call cannot talk to you.
        online.sort((a, b) => (getPresence(a, now) === 'busy') - (getPresence(b, now) === 'busy'));
        setOnlineUsers(online);
        setAllUsers(all);
      } catch (e) {
        console.error('[liveLobby] users load failed:', e);
      }
    };

    loadUsers();
    const interval = setInterval(loadUsers, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user.uid]);

  // Live searchers, so "somebody is waiting right now" is visible in-app and
  // not only through the push. Staleness is re-checked on a slow tick because a
  // killed app stops pinging without emitting a final snapshot.
  useEffect(() => subscribeToSearchingQueue(setRawSearchers), []);
  useEffect(() => {
    if (rawSearchers.length === 0) return undefined;
    const id = setInterval(() => setSearcherTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [rawSearchers.length]);

  const searcherNow = Date.now();
  const activeSearchers = rawSearchers.filter((t) => t.uid
    && t.uid !== user.uid
    && !t.sessionId
    && !blockedIds.has(t.uid)
    && searcherNow - lastAliveMs(t) <= SEARCH_STALE_MS);

  const handleMatched = useCallback((partnerUid, callId) => {
    navigate(`/chat/${partnerUid}`, {
      state: { acceptedCall: true, callId, matchedCall: true },
    });
  }, [navigate]);

  // When a search finds nobody the intent is NOT lost: the user joins the
  // current 2-hour block and the board opens. Someone arriving four minutes
  // later sees "1 person waiting" and matches instantly. The ticket used to be
  // deleted, which made that outcome physically impossible.
  const handleNoMatch = useCallback(async () => {
    setBoardOpenSignal((n) => n + 1);
    const slotId = currentBlockSlotId();
    if (!slotId) return;  // night hours — no block, just open the board
    const res = await joinPracticeSlot(slotId);
    if (res.ok && res.data?.matched) {
      setSlotToast(`Your call with ${res.data.partnerName || 'your partner'} is confirmed.`);
    } else {
      setSlotToast('Nobody is free right now. We saved your slot and will notify you when someone joins.');
    }
    setTimeout(() => setSlotToast(''), 8000);
  }, []);

  const { searching, startSearch, cancelSearch } = useMatchmaking({
    user,
    levelFilter,
    onMatched: handleMatched,
    onNoMatch: handleNoMatch,
  });

  useEffect(() => () => { cancelSearch(); }, [cancelSearch]);

  // There MUST be a way out of an appointment: a commitment with no exit makes
  // people stop booking at all. The message sent to the partner carries no name
  // and no blame (leavePracticeSlot), so cancelling is not a public shaming.
  const cancelUpcoming = useCallback(async () => {
    const uc = mine?.upcomingCall;
    if (!uc) return;
    if (!window.confirm('Cancel this call? Your partner will be notified.')) return;
    setCancelBusy(true);
    const res = await leavePracticeSlot(uc.slotId);
    setCancelBusy(false);
    if (!res.ok) setSlotToast(`⚠️ ${res.errorText}`);
    else setSlotToast('Call cancelled.');
    setTimeout(() => setSlotToast(''), 6000);
  }, [mine]);

  const joinCallNow = useCallback(() => {
    const uc = mine?.upcomingCall;
    if (!uc) return;
    navigate(`/chat/${uc.peerUid}`, {
      state: { acceptedCall: true, callId: uc.callId, matchedCall: true, slotId: uc.slotId },
    });
  }, [mine, navigate]);

  return {
    onlineUsers, allUsers, blockedIds, activeSearchers,
    levelFilter, setLevelFilter,
    searching, startSearch, cancelSearch,
    mine, slotChange, setSlotChange,
    slotToast, cancelBusy, cancelUpcoming, joinCallNow,
    boardOpenSignal, openBoard: () => setBoardOpenSignal((n) => n + 1),
  };
}

export default useLiveLobby;

import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToMyOffers } from '../utils/matchOffers';
import { subscribeToMyWeek, weekKeyOf } from '../utils/attendance';
import { BLOCK_MS } from '../utils/planState';

// Everything the Today and Plan screens say about a learner's week, from the
// documents the server keeps for it:
//   bookings/        confirmed practices (functions/bookings.js) — several now
//   matchOffers/     proposals waiting for a yes (weekly plan, refill, admin)
//   planStatus/{uid} what the last plan could do for them, honestly
//   onboarding/{uid} free times, weekly target, charter, pause
//   attendance/      held practices this week
// Each is one listener; nothing here writes except the pause switch.
export function subscribeToMyBookings(uid, cb) {
  if (!uid) return () => {};
  const q = query(
    collection(db, 'bookings'),
    where('participants', 'array-contains', uid),
    where('status', '==', 'confirmed'),
    where('startMs', '>', Date.now() - BLOCK_MS),
    orderBy('startMs'),
    limit(20),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => { console.warn('[plan] bookings', e.code); cb([]); });
}

// Pausing is the learner's own choice and costs nothing; the planner simply
// leaves them out (functions/index.js loadPlannerInputs).
export function setPlanPaused(uid, paused) {
  return setDoc(doc(db, 'onboarding', uid), { planPaused: !!paused }, { merge: true });
}

export default function useMyPlan(uid) {
  const [onboarding, setOnboarding] = useState(undefined); // undefined = loading
  const [bookings, setBookings] = useState([]);
  const [offers, setOffers] = useState([]);
  const [planStatus, setPlanStatus] = useState(null);
  const [attended, setAttended] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, 'onboarding', uid),
      (s) => setOnboarding(s.exists() ? s.data() : null),
      () => setOnboarding(null));
  }, [uid]);
  useEffect(() => subscribeToMyBookings(uid, setBookings), [uid]);
  useEffect(() => subscribeToMyOffers(uid, setOffers), [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, 'planStatus', uid), (s) => setPlanStatus(s.exists() ? s.data() : null), () => setPlanStatus(null));
  }, [uid]);
  useEffect(() => subscribeToMyWeek(uid, (events) => setAttended(events.filter((e) => e.outcome === 'attended').length)), [uid]);
  // Join opens five minutes before the start: re-evaluate every half minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  return {
    loading: onboarding === undefined,
    onboarding: onboarding || null,
    bookings, offers, planStatus, attended, now,
    weekKey: weekKeyOf(now),
  };
}

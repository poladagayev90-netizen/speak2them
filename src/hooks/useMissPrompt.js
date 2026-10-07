import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { MISS_KINDS, missReasonDoc, pendingMiss } from '../utils/missReasons';
import { markNever } from '../utils/weekProfile';

// The data behind «What happened?» (components/plan/MissReason.jsx): the
// learner's own misses and cancels (attendance, server-written) and the
// answers already given (missReasons). Answered on one screen, gone on all.
// «Not now» is remembered on this device only.
const dismissKey = (uid) => `missAsked:${uid}`;
const readDismissed = (uid) => {
  try { return new Set(JSON.parse(localStorage.getItem(dismissKey(uid)) || '[]')); } catch { return new Set(); }
};

export function saveMissReason(uid, fields) {
  const data = missReasonDoc({ uid, ...fields });
  return setDoc(doc(db, 'missReasons', `${data.eventId}_${uid}`), { ...data, at: serverTimestamp() });
}

// One tap after «the time was wrong»: that hour becomes Never in the general
// week profile, so the planner leaves it out from now on.
export function saveNeverHour(uid, onboarding, dayHour) {
  return setDoc(doc(db, 'onboarding', uid), markNever(onboarding, dayHour), { merge: true });
}

export default function useMissPrompt(uid, now = Date.now()) {
  // null = not loaded yet. Nothing is asked until BOTH lists are in: the
  // misses arriving first would show a question already answered.
  const [events, setEvents] = useState(null);
  const [answered, setAnswered] = useState(null);
  const [dismissed, setDismissed] = useState(() => readDismissed(uid));

  useEffect(() => {
    if (!uid) return undefined;
    const q = query(collection(db, 'attendance'), where('uid', '==', uid), where('outcome', 'in', MISS_KINDS), limit(30));
    return onSnapshot(q, (s) => setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setEvents(null));
  }, [uid]);
  useEffect(() => {
    if (!uid) return undefined;
    const q = query(collection(db, 'missReasons'), where('uid', '==', uid), limit(100));
    return onSnapshot(q, (s) => setAnswered(new Set(s.docs.map((d) => d.get('eventId')))), () => setAnswered(null));
  }, [uid]);

  const event = useMemo(() => (events && answered ? pendingMiss({ events, answered, dismissed, now }) : null),
    [events, answered, dismissed, now]);
  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem(dismissKey(uid), JSON.stringify([...next].slice(-50))); } catch { /* private mode */ }
      return next;
    });
  }, [uid]);
  return { event, dismiss, answered };
}

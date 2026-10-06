import { useEffect, useState } from 'react';
import {
  collection, deleteField, doc, FieldPath, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
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

// The learner's answer for one week (Plan tab calendar / Today check-in):
// the days they want to practise, or «not this week» (days = null). It only
// asks to be planned — the server still applies every rule and limit
// (functions/autoRoster.js). Answers older than four weeks are dropped.
export function saveWeek(uid, onboarding, monday, days) {
  const value = days ? { days: [...new Set(days)].sort(), at: serverTimestamp() } : { skip: true, at: serverTimestamp() };
  const cutoff = new Date(Date.parse(`${monday}T12:00:00Z`) - 28 * 86400000).toISOString().slice(0, 10);
  const args = [new FieldPath('weeks', monday), value];
  for (const k of Object.keys((onboarding && onboarding.weeks) || {})) {
    if (k < cutoff) args.push(new FieldPath('weeks', k), deleteField());
  }
  return updateDoc(doc(db, 'onboarding', uid), ...args);
}

// One more free block (the «popular time» a learner adds in one tap).
export function addFreeBlock(uid, onboarding, block) {
  const list = [...((onboarding && onboarding.availability) || []), { day: block.day, startMin: block.startMin, endMin: block.endMin }];
  return setDoc(doc(db, 'onboarding', uid), { availability: list }, { merge: true });
}

// Whether the autopilot is on (appConfig/planner.rosterMode) — the check-in
// questions only make sense when the learner's answer decides.
export function useAutoMode() {
  const [auto, setAuto] = useState(false);
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'planner'),
    (s) => setAuto(s.exists() && s.get('rosterMode') === 'auto'), () => setAuto(false)), []);
  return auto;
}

// Where people are free (appConfig/popularTimes, aggregate counts only).
export function usePopularTimes() {
  const [cells, setCells] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'popularTimes'),
    (s) => setCells(s.exists() ? (s.get('cells') || {}) : {}), () => setCells({})), []);
  return cells;
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

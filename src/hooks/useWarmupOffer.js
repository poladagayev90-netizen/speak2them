import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isAdminUser } from '../constants';
import { warmupOffer } from '../utils/warmupCall';

// Where Today offers the warm-up call: 'card' | 'panel' | null
// (src/utils/warmupCall.js warmupOffer). Home calls this ONCE and hands the
// answer to both places, so the card and the Get ready row can never both
// show. Only a possible candidate (newcomer, or an admin testing) reads
// anything; everyone else costs no Firestore read.
export default function useWarmupOffer(user) {
  const admin = isAdminUser(user);
  const candidate = !!user && (admin || (!(Number(user.callCount) > 0) && user.role !== 'teacher'));
  const [config, setConfig] = useState(undefined);
  const [record, setRecord] = useState(undefined);

  useEffect(() => {
    if (!candidate) return undefined;
    const offCfg = onSnapshot(doc(db, 'appConfig', 'warmupCall'),
      (s) => setConfig(s.exists() ? s.data() : null), () => setConfig(null));
    const offRec = onSnapshot(doc(db, 'warmupCalls', user.uid),
      (s) => setRecord(s.exists() ? s.data() : null), () => setRecord(null));
    return () => { offCfg(); offRec(); };
  }, [candidate, user?.uid]);

  if (!candidate) return null;
  const loading = config === undefined || record === undefined;
  return warmupOffer({ user, record, config, loading, admin });
}

// «Not now» on the card, or «Go straight to my partners» on the intro: the
// card leaves Today and the warm-up waits as one row in Get ready. A plain
// owner-writable field on users — it unlocks nothing.
export function dismissWarmup(uid) {
  if (!uid) return Promise.resolve();
  return updateDoc(doc(db, 'users', uid), { warmupDismissedAt: serverTimestamp() }).catch(() => {});
}

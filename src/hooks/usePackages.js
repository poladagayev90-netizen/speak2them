import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { billingConfig, packageView } from '../utils/packages';

// The admin's package settings (appConfig/billing — any signed-in user may
// read it) and this learner's balance as the server last worked it out
// (planStatus/{uid}.access). Two listeners, nothing written.
export function useBillingConfig() {
  const [raw, setRaw] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'appConfig', 'billing'),
    (s) => setRaw(s.exists() ? s.data() : {}),
    () => setRaw({})), []);
  return useMemo(() => ({ config: billingConfig(raw || {}), loaded: raw !== null }), [raw]);
}

export default function usePackages(user) {
  const uid = user?.uid || null;
  const { config, loaded } = useBillingConfig();
  const [summary, setSummary] = useState(undefined);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(doc(db, 'planStatus', uid),
      (s) => setSummary(s.exists() ? s.get('access') || null : null),
      () => setSummary(null));
  }, [uid]);
  const view = useMemo(() => packageView({ user, summary, config }), [user, summary, config]);
  return { config, view, summary, loading: !loaded || summary === undefined };
}

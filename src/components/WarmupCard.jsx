import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Mic } from 'lucide-react';
import { db } from '../firebase';
import Card from './ui/Card';
import Button from './ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { showWarmupCard } from '../utils/warmupCall';
import '../pages/WarmupCall.css';

// Today's offer of the one warm-up call (docs/domain/calls.md). Only a
// learner who has never had a real call reads anything here; everyone else
// costs no Firestore read.
export default function WarmupCard({ user }) {
  const navigate = useNavigate();
  const { t } = useFirstRunCopy(user?.guideLanguage);
  const candidate = !!user && !(Number(user.callCount) > 0) && user.role !== 'teacher';
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

  const loading = config === undefined || record === undefined;
  if (!candidate || !showWarmupCard({ user, record, config, loading })) return null;

  return (
    <Card tone="ai" className="wu-card">
      <div className="wu-card-head">
        <img src="/ainur_avatar.png" alt="" className="wu-card-avatar" />
        <div>
          <h2 className="wu-card-title">{t('warm.card.title')}</h2>
          <p className="wu-card-sub">{t('warm.card.sub')}</p>
        </div>
      </div>
      <Button variant="ai" full icon={<Mic size={18} aria-hidden="true" />} onClick={() => navigate('/warmup')}>
        {t('warm.card.start')}
      </Button>
    </Card>
  );
}

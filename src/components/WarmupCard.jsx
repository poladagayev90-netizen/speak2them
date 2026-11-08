import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { dismissWarmup } from '../hooks/useWarmupOffer';
import { WARMUP_AVATAR } from '../utils/warmupCall';
import '../pages/WarmupCall.css';

// Today's offer of the one warm-up call (docs/domain/calls.md). Shown only
// while `offer === 'card'` (Home → useWarmupOffer): a newcomer before their
// first real call who has not put it aside. «Not now» moves it into the Get
// ready card as one row.
export default function WarmupCard({ user, offer }) {
  const navigate = useNavigate();
  const { t } = useFirstRunCopy(user?.guideLanguage);
  if (offer !== 'card') return null;

  return (
    <Card tone="ai" className="wu-card">
      <div className="wu-card-head">
        <img src={WARMUP_AVATAR} alt="" className="wu-card-avatar" />
        <div>
          <h2 className="wu-card-title">{t('warm.card.title')}</h2>
          <p className="wu-card-sub">{t('warm.card.sub')}</p>
        </div>
      </div>
      <Button variant="ai" full icon={<Mic size={18} aria-hidden="true" />} onClick={() => navigate('/warmup')}>
        {t('warm.card.start')}
      </Button>
      <Button variant="ghost" full onClick={() => dismissWarmup(user?.uid)}>
        {t('warm.card.later')}
      </Button>
    </Card>
  );
}

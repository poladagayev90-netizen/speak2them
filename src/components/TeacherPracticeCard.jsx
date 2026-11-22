import React from 'react';
import { MessageCircle, GraduationCap } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { dismissWarmup } from '../hooks/useWarmupOffer';
import { isAdminUser, whatsappLink } from '../constants';
import { teacherCardVisible, teacherPracticeText } from '../utils/teacherPractice';
import '../pages/WarmupCall.css';

// «Not ready? Practise with a teacher — free» — Today, in the warm-up card's
// old place (rules: utils/teacherPractice.js). Words follow the first-run
// language like the card it replaced (data/firstRunCopy.js `teach.card.*`).
// The button opens the team's WhatsApp with a prefilled line; the practice
// and its time are arranged there by hand.
export default function TeacherPracticeCard({ user }) {
  const { t } = useFirstRunCopy(user?.guideLanguage);
  if (!teacherCardVisible(user, { admin: isAdminUser(user) })) return null;

  const open = () => window.open(whatsappLink(teacherPracticeText(user)), '_blank', 'noopener');

  return (
    <Card tone="peer" className="wu-card">
      <div className="wu-card-head">
        <span className="tp-card-icon" aria-hidden="true"><GraduationCap size={22} /></span>
        <div>
          <h2 className="wu-card-title">{t('teach.card.title')}</h2>
          <p className="wu-card-sub">{t('teach.card.sub')}</p>
        </div>
      </div>
      <Button variant="primary" full icon={<MessageCircle size={18} aria-hidden="true" />} onClick={open}>
        {t('teach.card.start')}
      </Button>
      <Button variant="ghost" full onClick={() => dismissWarmup(user?.uid)}>
        {t('teach.card.later')}
      </Button>
    </Card>
  );
}

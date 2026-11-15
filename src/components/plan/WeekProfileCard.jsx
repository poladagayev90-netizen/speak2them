import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import { Button } from '../ui';
import { needsWeekProfile } from '../../utils/weekProfile';
import { practiceText } from '../../data/practiceCopy';
import './plan.css';

// Today, for learners who were already practising before the general week
// profile existed: one card that opens the onboarding grid with its Free /
// Maybe / Never switch. Saving there stamps onboarding.weekProfileAt and the
// card is gone for good; «Later» hides it on this device for three days.
const LATER_MS = 3 * 24 * 60 * 60 * 1000;

// `lang` — the practice path's language (data/practiceCopy.js).
export default function WeekProfileCard({ user, onboarding, lang = 'en' }) {
  const navigate = useNavigate();
  const t = (key) => practiceText(lang, key);
  const key = `weekProfileLater:${user?.uid}`;
  const [later, setLater] = useState(() => {
    try { return Number(localStorage.getItem(key)) > Date.now(); } catch { return false; }
  });
  if (later || !needsWeekProfile(user, onboarding)) return null;
  const putOff = () => {
    try { localStorage.setItem(key, String(Date.now() + LATER_MS)); } catch { /* private mode */ }
    setLater(true);
  };
  return (
    <section className="pl-card wp-card" aria-label="Your usual week">
      <span className="pl-row-icon" aria-hidden="true"><CalendarRange size={18} /></span>
      <div className="wp-card-main">
        <p className="pl-row-title">{t('week.title')}</p>
        <p className="mr-sub">{t('week.text')}</p>
        <div className="wp-card-actions">
          <Button size="sm" onClick={() => navigate('/onboarding', { state: { jumpTo: 'availability', returnTo: '/' } })}>
            {t('week.open')}
          </Button>
          <Button size="sm" variant="ghost" onClick={putOff}>{t('week.later')}</Button>
        </div>
      </div>
    </section>
  );
}

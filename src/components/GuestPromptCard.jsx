import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CalendarDays, MessageCircle, FlaskConical, Bot, Trophy } from 'lucide-react';
import Button from './ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { GuestContext } from '../utils/guest';
import './plan/plan.css';

const SECTION_META = {
  plan: { Icon: CalendarDays, titleKey: 'guest.planTitle', subKey: 'guest.planSub' },
  partners: { Icon: MessageCircle, titleKey: 'guest.partnersTitle', subKey: 'guest.partnersSub' },
  lab: { Icon: FlaskConical, titleKey: 'guest.labTitle', subKey: 'guest.labSub' },
  ainur: { Icon: Bot, titleKey: 'guest.ainurTitle', subKey: 'guest.ainurSub' },
  board: { Icon: Trophy, titleKey: 'guest.boardTitle', subKey: 'guest.boardSub' },
};

// Reusable Plum card shown to guest visitors on Today (compact top banner)
// and on account-only tabs (Plan, Partners, Lab, Ranking, AInur).
export default function GuestPromptCard({ variant = 'page', section = 'plan', guideLanguage = null }) {
  const navigate = useNavigate();
  const { exitGuest } = useContext(GuestContext);
  const { t, lang } = useFirstRunCopy(guideLanguage);

  const goAuth = (path) => {
    exitGuest();
    navigate(path);
  };

  if (variant === 'hero') {
    return (
      <section className="pl-card pl-card--hero" lang={lang} aria-label={t('guest.badge')}>
        <p className="pl-kicker">
          <Sparkles size={15} aria-hidden="true" />
          {t('guest.badge')}
        </p>
        <h2 className="pl-title">{t('guest.heroTitle')}</h2>
        <p className="pl-text">{t('guest.heroSub')}</p>
        <div className="pl-actions">
          <Button onClick={() => goAuth('/register')}>{t('guest.signup')}</Button>
          <Button variant="secondary" onClick={() => goAuth('/login')}>{t('guest.signin')}</Button>
        </div>
      </section>
    );
  }

  const meta = SECTION_META[section] || SECTION_META.plan;
  const Icon = meta.Icon;

  return (
    <div className="home-page" lang={lang}>
      <div className="home-body" style={{ paddingBottom: '110px' }}>
        <section className="pl-card" style={{ marginTop: 'var(--s-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
            <span className="pl-row-icon" style={{ width: 44, height: 44 }} aria-hidden="true">
              <Icon size={22} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="pl-kicker" style={{ marginBottom: 4 }}>{t('guest.badge')}</p>
              <h1 className="pl-title">{t(meta.titleKey)}</h1>
            </div>
          </div>
          <p className="pl-text">{t(meta.subKey)}</p>
          <div className="pl-actions">
            <Button onClick={() => goAuth('/register')}>{t('guest.signup')}</Button>
            <Button variant="secondary" onClick={() => goAuth('/login')}>{t('guest.signin')}</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

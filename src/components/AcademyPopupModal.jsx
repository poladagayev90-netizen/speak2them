import React from 'react';
import { MonitorPlay, ExternalLink } from 'lucide-react';
import Button from './ui/Button';
import useFirstRunCopy from '../hooks/useFirstRunCopy';
import { openAcademy } from '../utils/academyLink';

// Polite newcomer popup pointing to SpeakLab Academy (up to 3 shows, 1x/day,
// dismissed permanently once opened). Uses the app's Plum modal overlay.
export default function AcademyPopupModal({ open, user, onClose }) {
  const { t, lang } = useFirstRunCopy(user?.guideLanguage);
  if (!open) return null;

  const handleOpen = () => {
    openAcademy(user?.uid);
    onClose();
  };

  return (
    <div className="topic-intro-overlay" role="dialog" aria-modal="true" aria-labelledby="acad-pop-title">
      <div className="topic-intro-modal" lang={lang}>
        <div
          className="pl-row-icon"
          aria-hidden="true"
          style={{ width: 52, height: 52, borderRadius: 'var(--r-lg)', margin: '0 auto var(--s-3)' }}
        >
          <MonitorPlay size={26} strokeWidth={1.9} />
        </div>
        <p className="topic-intro-label" style={{ marginBottom: 8 }}>{t('acad.pop.kicker')}</p>
        <h2 id="acad-pop-title" className="topic-intro-title" style={{ fontSize: 'var(--fs-h1)', marginBottom: 10 }}>
          {t('acad.pop.title')}
        </h2>
        <p className="topic-intro-desc" style={{ marginBottom: 22 }}>
          {t('acad.pop.sub')}
        </p>
        <div className="topic-intro-actions">
          <Button
            variant="primary"
            size="lg"
            full
            icon={<ExternalLink size={18} aria-hidden="true" />}
            onClick={handleOpen}
          >
            {t('acad.pop.open')}
          </Button>
          <button type="button" className="topic-intro-btn-secondary" onClick={onClose}>
            {t('acad.pop.later')}
          </button>
        </div>
      </div>
    </div>
  );
}

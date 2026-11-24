import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { whenLabel, peerOf } from '../../utils/planState';
import { practiceText } from '../../data/practiceCopy';
import './plan.css';

// This week: the commitment from onboarding (weeklyTarget) against what was
// actually held, and the practices still ahead — one line each. The full week,
// with cancel and change time, is the Plan tab; Today only shows the shape.
//
// Only held calls fill a dot. A missed one is not drawn in red here: the goal
// is to make the commitment visible, not to shame (see WeekGoalCard's note).
export default function ThisWeekCard({ uid, target, attended, bookings, skipFirst = true, showList = true, now, lang = 'en' }) {
  const pt = (k, v) => practiceText(lang, k, v);
  const navigate = useNavigate();
  if (!target) return null;
  // On the Plan tab the bookings are listed right above, so only the count shows.
  const ahead = !showList ? [] : skipFirst ? bookings.slice(1) : bookings;
  const dots = Math.max(target, Math.min(attended, 7));
  const left = Math.max(0, target - attended);

  return (
    <section className="pl-card" aria-label={pt('tw.title')}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)' }}>
        <p className="ui-section-label" style={{ margin: 0 }}>{pt('tw.title')}</p>
        <span className="pl-kicker-end" style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)' }}>
          {pt('tw.done', { a: attended, t: `${target}${target === 4 ? '+' : ''}` })}
        </span>
      </div>
      <div className="pl-dots" role="img" aria-label={pt('tw.done', { a: attended, t: target })}>
        {Array.from({ length: dots }, (_, i) => <span key={i} className={i < attended ? 'is-on' : ''} />)}
      </div>
      <p className="pl-text">
        {attended >= target ? pt('tw.reached') : pt('tw.left', { left, booked: bookings.length })}
      </p>
      {ahead.length > 0 && (
        <div className="pl-rows">
          {ahead.slice(0, 3).map((b) => (
            <button key={b.id} type="button" className="pl-row" onClick={() => navigate('/plan')}>
              <span className="pl-row-main">
                <p className="pl-row-title">{whenLabel(b.startMs, now, lang)}</p>
                <p className="pl-row-sub">{pt('tw.with', { name: peerOf(b, uid).peerName })}</p>
              </span>
              <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

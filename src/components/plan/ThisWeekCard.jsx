import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { whenLabel, peerOf } from '../../utils/planState';
import './plan.css';

// This week: the commitment from onboarding (weeklyTarget) against what was
// actually held, and the practices still ahead — one line each. The full week,
// with cancel and change time, is the Plan tab; Today only shows the shape.
//
// Only held calls fill a dot. A missed one is not drawn in red here: the goal
// is to make the commitment visible, not to shame (see WeekGoalCard's note).
export default function ThisWeekCard({ uid, target, attended, bookings, skipFirst = true, showList = true, now }) {
  const navigate = useNavigate();
  if (!target) return null;
  // On the Plan tab the bookings are listed right above, so only the count shows.
  const ahead = !showList ? [] : skipFirst ? bookings.slice(1) : bookings;
  const dots = Math.max(target, Math.min(attended, 7));
  const left = Math.max(0, target - attended);

  return (
    <section className="pl-card" aria-label="This week">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)' }}>
        <p className="ui-section-label" style={{ margin: 0 }}>This week</p>
        <span className="pl-kicker-end" style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)' }}>
          {attended} of {target}{target === 4 ? '+' : ''} done
        </span>
      </div>
      <div className="pl-dots" role="img" aria-label={`${attended} of ${target} practices this week`}>
        {Array.from({ length: dots }, (_, i) => <span key={i} className={i < attended ? 'is-on' : ''} />)}
      </div>
      <p className="pl-text">
        {attended >= target ? 'Goal reached for this week.'
          : `${left} more to reach your goal${bookings.length ? ` · ${bookings.length} booked` : ''}.`}
      </p>
      {ahead.length > 0 && (
        <div className="pl-rows">
          {ahead.slice(0, 3).map((b) => (
            <button key={b.id} type="button" className="pl-row" onClick={() => navigate('/plan')}>
              <span className="pl-row-main">
                <p className="pl-row-title">{whenLabel(b.startMs, now)}</p>
                <p className="pl-row-sub">with {peerOf(b, uid).peerName}</p>
              </span>
              <ChevronRight size={18} className="pl-row-end" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

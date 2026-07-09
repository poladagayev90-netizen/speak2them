import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { streakTier, nextMilestone, isMilestone } from '../utils/streak';

const MILESTONE_ICON = { 3: '🌱', 7: '🔥', 14: '💎', 30: '👑', 60: '🏆', 100: '🚀' };

// Full-screen "streak journey" — a winding trail of day-nodes. Days up to the
// current count are lit, today pulses, future days are dim/locked. Milestones
// stand out. Bounded node count keeps long streaks from rendering endlessly.
export default function StreakJourney({ open, streakInfo, onClose }) {
  const count = streakInfo?.count || 0;
  const tier = streakTier(count);
  const next = nextMilestone(count);
  const maxDay = Math.min(Math.max(count + 3, 30), 120);
  const currentRef = useRef(null);

  useEffect(() => {
    if (open && currentRef.current) {
      currentRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [open]);

  if (!open) return null;

  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <div className="journey-overlay">
      <div className="journey-header">
        <button className="journey-close" onClick={onClose} aria-label="Bağla"><X size={22} /></button>
        <div className="journey-head-count" style={{ color: tier.accent }}>🔥 {count}</div>
        <div className="journey-head-sub">
          {count === 0
            ? 'Bu gün danışıb səyahətə başla!'
            : (next ? `Növbəti hədəf: ${next.target} gün — ${next.remaining} gün qaldı` : 'Bütün hədəflər fəth edildi! 👑')}
        </div>
      </div>

      <div className="journey-trail">
        {days.map((d) => {
          const done = d <= count && count > 0;
          const current = d === count && count > 0;
          const milestone = isMilestone(d);
          const side = d % 2 === 0 ? 'left' : 'right';
          return (
            <div
              key={d}
              ref={current ? currentRef : null}
              className={`journey-node journey-node--${side}${done ? ' is-done' : ''}${current ? ' is-current' : ''}${milestone ? ' is-milestone' : ''}`}
              style={done ? { '--node-accent': tier.accent } : undefined}
            >
              <div className="journey-dot">
                {milestone ? (MILESTONE_ICON[d] || '⭐') : (done ? d : (current ? d : ''))}
                {!done && !current && !milestone && <span className="journey-lock">🔒</span>}
              </div>
              {milestone && <div className="journey-node-label">{d} gün</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

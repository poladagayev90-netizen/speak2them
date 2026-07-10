import React, { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { streakTier, nextMilestone, isMilestone } from '../utils/streak';

const MILESTONE_ICON = { 3: '🌱', 7: '🔥', 14: '💎', 30: '👑', 60: '🏆', 100: '🚀' };

// Decorative ember specks scattered over the dark backdrop; positions are
// random per open, animation is gated behind prefers-reduced-motion in CSS.
const makeSparks = () =>
  Array.from({ length: 10 }, () => ({
    left: `${5 + Math.random() * 90}%`,
    top: `${8 + Math.random() * 84}%`,
    delay: `${Math.round(Math.random() * 2200)}ms`,
    size: Math.random() > 0.5 ? 10 : 7,
  }));

// Full-screen "streak journey" — a glowing trail of day-nodes. Days up to the
// current count are lit, today pulses, future days are dim/locked. Milestones
// stand out. Bounded node count keeps long streaks from rendering endlessly.
export default function StreakJourney({ open, streakInfo, onClose }) {
  const count = streakInfo?.count || 0;
  const tier = streakTier(count);
  const next = nextMilestone(count);
  const maxDay = Math.min(Math.max(count + 3, 30), 120);
  const currentRef = useRef(null);
  const sparks = useMemo(() => (open ? makeSparks() : []), [open]);

  useEffect(() => {
    if (open && currentRef.current) {
      currentRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [open]);

  if (!open) return null;

  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  // Header bar: progress towards the NEXT milestone. Trail spine: how far the
  // lit segment reaches down the full rendered path.
  const milestonePct = next ? Math.round((count / next.target) * 100) : 100;
  const trailPct = Math.min(100, Math.round((count / maxDay) * 100));

  return (
    <div className="journey-overlay" style={{ '--journey-accent': tier.accent }}>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="journey-spark"
          aria-hidden="true"
          style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: s.delay }}
        >
          ✦
        </span>
      ))}

      <div className="journey-header">
        <button className="journey-close" onClick={onClose} aria-label="Bağla"><X size={22} /></button>
        <div className="journey-hero-flame" aria-hidden="true">🔥</div>
        <div className="journey-head-count" style={{ color: tier.accent }}>
          {count} <span className="journey-head-days">gün</span>
        </div>
        <div className="journey-head-tier">{tier.title}</div>
        <div className="journey-progress-track" role="progressbar" aria-valuenow={milestonePct} aria-valuemin={0} aria-valuemax={100}>
          <div className="journey-progress-fill" style={{ width: `${milestonePct}%` }} />
        </div>
        <div className="journey-head-sub">
          {count === 0
            ? 'Bu gün danışıb səyahətə başla!'
            : (next ? `Növbəti hədəf: ${MILESTONE_ICON[next.target] || '⭐'} ${next.target} gün — ${next.remaining} gün qaldı` : 'Bütün hədəflər fəth edildi! 👑')}
        </div>
      </div>

      <div className="journey-trail" style={{ '--journey-trail-fill': `${trailPct}%` }}>
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
              {current && <div className="journey-node-label journey-node-label--today">Bugün 🎉</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

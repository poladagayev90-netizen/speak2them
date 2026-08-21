import React, { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { streakTier, nextMilestone } from '../utils/streak';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CONFETTI_COLORS = ['var(--warning)', 'var(--accent)', '#22d3ee', 'var(--danger)', '#22c55e', '#fb923c'];

// Full-screen daily streak celebration. Content scales with the streak tier;
// heavy motion is gated behind prefers-reduced-motion.
export default function StreakModal({ open, streakInfo, onClose, onOpenJourney }) {
  const count = streakInfo?.count || 0;
  const tier = streakTier(count);
  const [display, setDisplay] = useState(count);

  const confetti = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      left: Math.round((i / 26) * 100 + (Math.random() * 6 - 3)),
      delay: Math.random() * 0.5,
      dur: 1.4 + Math.random() * 1.1,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot: Math.round(Math.random() * 360),
    })),
    []
  );

  // Count-up animation from 0 → count.
  useEffect(() => {
    if (!open) return undefined;
    if (prefersReducedMotion() || count <= 0) { setDisplay(count); return undefined; }
    let raf;
    const start = performance.now();
    const dur = 800;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(count * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, count]);

  if (!open) return null;

  const showConfetti = (tier.effect === 'confetti' || tier.effect === 'crown') && !prefersReducedMotion();
  const showCrown = tier.effect === 'crown';
  const next = nextMilestone(count);

  return (
    <div className="streak-overlay" role="dialog" aria-modal="true" aria-label="Streak">
      {showConfetti && (
        <div className="streak-confetti" aria-hidden="true">
          {confetti.map((c, i) => (
            <span key={i} style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
              transform: `rotate(${c.rot}deg)`,
            }} />
          ))}
        </div>
      )}

      <div className="streak-card" style={{ '--streak-accent': tier.accent }}>
        {showCrown && <div className="streak-crown" aria-hidden="true"></div>}

        <div className={`streak-flame streak-flame--${tier.effect}`} aria-hidden="true">
          <span className="streak-flame-emoji"><Flame size={44} strokeWidth={1.5} /></span>
          <span className="streak-flame-glow" />
        </div>

        <div className="streak-count" style={{ color: tier.accent }}>{display}</div>
        <div className="streak-days">day streak</div>

        <h2 className="streak-title">{tier.title}</h2>
        <p className="streak-message">
          {tier.message}
          {streakInfo?.alive && !streakInfo?.doneToday && (
            <><br /><b style={{ color: tier.accent }}>Talk today to keep your streak.</b></>
          )}
        </p>

        {next && (
          <div className="streak-next">
            Next milestone: <b>{next.target} days</b> — {next.remaining} days to go
          </div>
        )}

        <button className="streak-btn-primary" style={{ background: tier.accent }} onClick={onClose}>
          Start
        </button>
        <button className="streak-btn-secondary" onClick={onOpenJourney}>
          🗺️ See your journey
        </button>
      </div>
    </div>
  );
}

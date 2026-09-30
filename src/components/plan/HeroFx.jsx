import React from 'react';

// The moving layer of Today's headline card: the colour drift, a wandering
// light and, now and then, a small fish swimming through.
//
// Polad (2026-09-30): the colours restarted every time he changed page. A CSS
// animation starts at 0 whenever its element mounts, so the phase is taken
// from the wall clock instead — a negative animation-delay of (now mod period)
// puts every mount, page change and app restart at the same point of the same
// cycle. Periods here must match plan.css.
export const HERO_DRIFT_MS = 18000;  // alternate → a full there-and-back is 2×
export const HERO_LIGHT_MS = 23000;  // alternate
export const HERO_FISH_MS = 24000;   // swims ~14 s of this, then ~10 s of empty water

const phase = (period) => `-${Date.now() % period}ms`;

export function heroClockStyle() {
  return {
    '--hero-drift-delay': phase(HERO_DRIFT_MS * 2),
    '--hero-light-delay': phase(HERO_LIGHT_MS * 2),
    '--hero-fish-delay': phase(HERO_FISH_MS),
  };
}

// A faint silhouette, white on the fill — present, never the thing you look at.
export default function HeroFish() {
  return (
    <span className="pl-hero-fish" aria-hidden="true">
      <span className="pl-hero-fish-bob">
        <svg viewBox="0 0 64 30" width="58" height="27">
          <g className="pl-hero-fish-tail">
            <path d="M15 15 L1 4 Q6 15 1 26 Z" fill="currentColor" />
          </g>
          <path d="M13 15 C20 3, 44 1, 58 12 Q62 15 58 18 C44 29, 20 27, 13 15 Z" fill="currentColor" />
          <path d="M33 7 Q38 1 45 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="50" cy="12.6" r="2.1" fill="var(--hero-fish-eye)" />
        </svg>
      </span>
    </span>
  );
}

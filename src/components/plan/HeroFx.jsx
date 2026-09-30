import React from 'react';

// The moving layer of Today's headline card: the colour drift, a wandering
// light and, now and then, a sea creature swimming through.
//
// Polad (2026-09-30): the colours restarted every time he changed page. A CSS
// animation starts at 0 whenever its element mounts, so the phase is taken
// from the wall clock instead — a negative animation-delay of (now mod period)
// puts every mount, page change and app restart at the same point of the same
// cycle. Periods here must match plan.css.
export const HERO_DRIFT_MS = 18000;  // alternate → a full there-and-back is 2×
export const HERO_LIGHT_MS = 23000;  // alternate
// The sea parade (Polad, 2026-10-01): one visitor per 20 s slot over a 120 s
// cycle — fish, whale, otter, manta ray, octopus, then a school of small fish
// that, unlike the others, darts across fast and together. Each creature runs
// the full 120 s animation and is off the card outside its own slot (plan.css
// .pl-sea--*), so no timer is needed.
export const HERO_PARADE_MS = 120000;

const phase = (period) => `-${Date.now() % period}ms`;

export function heroClockStyle() {
  return {
    '--hero-drift-delay': phase(HERO_DRIFT_MS * 2),
    '--hero-light-delay': phase(HERO_LIGHT_MS * 2),
    '--hero-parade-delay': phase(HERO_PARADE_MS),
  };
}

// Faint silhouettes, white on the fill — present, never the thing you look at.
// One colour (currentColor); the eyes take --hero-fish-eye, the card's dark.
export default function HeroParade() {
  return (
    <span className="pl-parade" aria-hidden="true">
      <span className="pl-sea pl-sea--fish">
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

      {/* Whale: big, slow, low in the water; the flukes sway. */}
      <span className="pl-sea pl-sea--whale">
        <span className="pl-sea-bob pl-sea-bob--slow">
          <svg viewBox="0 0 132 56" width="132" height="56">
            <g className="pl-whale-flukes">
              <path d="M22 32 C15 28, 8 18, 1 15 C5 24, 8 29, 13 32 C8 36, 5 42, 1 50 C8 46, 15 38, 22 34 Z" fill="currentColor" />
            </g>
            <path d="M18 33 C24 14, 66 6, 104 16 C118 20, 128 28, 124 36 C112 50, 60 50, 30 42 C24 40, 20 37, 18 33 Z" fill="currentColor" />
            <path d="M60 44 Q70 54 78 45" fill="currentColor" />
            <circle cx="110" cy="27" r="2.4" fill="var(--hero-fish-eye)" />
            <path d="M100 37 Q112 40 122 35" fill="none" stroke="var(--hero-fish-eye)" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
          </svg>
        </span>
      </span>

      {/* Otter: floating on its back near the surface, holding a pebble. */}
      <span className="pl-sea pl-sea--otter">
        <span className="pl-otter-rock">
          <svg viewBox="0 0 76 40" width="76" height="40">
            <path d="M12 25 Q3 22 1 27 Q6 29 12 28 Z" fill="currentColor" />
            <path d="M10 26 C10 17, 34 14, 54 16 C64 17, 68 22, 66 26 C62 31, 32 32, 14 30 C11 29, 10 28, 10 26 Z" fill="currentColor" />
            <circle cx="64" cy="19" r="8.5" fill="currentColor" />
            <circle cx="60" cy="11.5" r="2.4" fill="currentColor" />
            <circle cx="66.5" cy="18" r="1.5" fill="var(--hero-fish-eye)" />
            <circle cx="71.5" cy="21" r="1.4" fill="var(--hero-fish-eye)" />
            <path d="M18 18 L14 10 M24 17 L22 9" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
            <g className="pl-otter-paws">
              <ellipse cx="44" cy="9" rx="5" ry="3.6" fill="currentColor" />
              <path d="M38 15 L41 10 M50 15 L47 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
        </span>
      </span>

      {/* Manta ray, seen from above: glides, the wings beating slowly. */}
      <span className="pl-sea pl-sea--manta">
        <span className="pl-sea-bob">
          <svg viewBox="0 0 96 60" width="96" height="60">
            <path d="M40 30 L1 31" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <g className="pl-manta-wings">
              <path d="M78 30 C66 14, 46 2, 34 2 C42 12, 44 20, 40 30 C44 40, 42 48, 34 58 C46 58, 66 46, 78 30 Z" fill="currentColor" />
            </g>
            <path d="M76 25 Q86 22 88 26 Q84 28 78 28 Z M76 35 Q86 38 88 34 Q84 32 78 32 Z" fill="currentColor" />
          </svg>
        </span>
      </span>

      {/* Octopus: rises on a slant, squeezing and trailing its arms. */}
      <span className="pl-sea pl-sea--octopus">
        <span className="pl-octo-tilt">
          <svg viewBox="0 0 52 66" width="46" height="58" className="pl-octo">
            <g className="pl-octo-arms">
              {[10, 18, 26, 34, 42].map((x, i) => (
                <path key={x} d={`M${x} 30 Q${x + (i % 2 ? 5 : -5)} 46 ${x + (i % 2 ? -2 : 2)} 63`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              ))}
            </g>
            <g className="pl-octo-head">
              <path d="M6 30 C4 12, 14 2, 26 2 C38 2, 48 12, 46 30 C40 35, 12 35, 6 30 Z" fill="currentColor" />
              <circle cx="19" cy="24" r="2.4" fill="var(--hero-fish-eye)" />
              <circle cx="33" cy="24" r="2.4" fill="var(--hero-fish-eye)" />
            </g>
          </svg>
        </span>
      </span>

      {/* School: many small fish, fast and together — the one crossing that
          darts instead of drifting. Each fish bobs a little on its own. */}
      <span className="pl-sea pl-sea--school">
        <span className="pl-school-wave">
          <svg viewBox="0 0 112 56" width="112" height="56">
            <defs>
              <path id="pl-minnow" d="M0 1 L5.5 4 L0 7 Z M4 4 C7 0, 14 0, 17 4 C14 8, 7 8, 4 4 Z" fill="currentColor" />
            </defs>
            {[[0, 26], [16, 14], [18, 36], [34, 6], [36, 24], [34, 44], [54, 14], [56, 34], [74, 24], [90, 16], [92, 34]].map(([x, y], i) => (
              <g key={i} className="pl-minnow" style={{ '--i': i }} transform={`translate(${x} ${y})`}>
                <use href="#pl-minnow" />
              </g>
            ))}
          </svg>
        </span>
      </span>
    </span>
  );
}

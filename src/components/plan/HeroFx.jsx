import React from 'react';
import { FishSvg, WhaleSvg, OtterSvg, MantaSvg, OctopusSvg } from './SeaCreatures';

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
          <FishSvg />
        </span>
      </span>

      {/* Whale: big, slow, low in the water; the flukes sway. */}
      <span className="pl-sea pl-sea--whale">
        <span className="pl-sea-bob pl-sea-bob--slow">
          <WhaleSvg />
        </span>
      </span>

      {/* Otter: floating on its back near the surface, holding a pebble. */}
      <span className="pl-sea pl-sea--otter">
        <span className="pl-otter-rock">
          <OtterSvg />
        </span>
      </span>

      {/* Manta ray, seen from above: glides, the wings beating slowly. */}
      <span className="pl-sea pl-sea--manta">
        <span className="pl-sea-bob">
          <MantaSvg />
        </span>
      </span>

      {/* Octopus: rises on a slant, squeezing and trailing its arms. */}
      <span className="pl-sea pl-sea--octopus">
        <span className="pl-octo-tilt">
          <OctopusSvg />
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

import React from 'react';

// The sea creatures of the hero card's parade (HeroFx.jsx), on their own so
// another page can use them — the package cards on /packages give each size a
// creature (fish → octopus → manta → whale). One colour (currentColor); the
// eyes take `eye`, the colour of whatever they swim on. The part classes
// (pl-hero-fish-tail, pl-whale-flukes, …) carry the small motions in plan.css.

export function FishSvg({ width = 58, eye = 'var(--hero-fish-eye)' }) {
  return (
    <svg viewBox="0 0 64 30" width={width} height={(width * 30) / 64}>
      <g className="pl-hero-fish-tail">
        <path d="M15 15 L1 4 Q6 15 1 26 Z" fill="currentColor" />
      </g>
      <path d="M13 15 C20 3, 44 1, 58 12 Q62 15 58 18 C44 29, 20 27, 13 15 Z" fill="currentColor" />
      <path d="M33 7 Q38 1 45 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="50" cy="12.6" r="2.1" fill={eye} />
    </svg>
  );
}

export function WhaleSvg({ width = 132, eye = 'var(--hero-fish-eye)' }) {
  return (
    <svg viewBox="0 0 132 56" width={width} height={(width * 56) / 132}>
      <g className="pl-whale-flukes">
        <path d="M22 32 C15 28, 8 18, 1 15 C5 24, 8 29, 13 32 C8 36, 5 42, 1 50 C8 46, 15 38, 22 34 Z" fill="currentColor" />
      </g>
      <path d="M18 33 C24 14, 66 6, 104 16 C118 20, 128 28, 124 36 C112 50, 60 50, 30 42 C24 40, 20 37, 18 33 Z" fill="currentColor" />
      <path d="M60 44 Q70 54 78 45" fill="currentColor" />
      <circle cx="110" cy="27" r="2.4" fill={eye} />
      <path d="M100 37 Q112 40 122 35" fill="none" stroke={eye} strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function OtterSvg({ width = 76, eye = 'var(--hero-fish-eye)' }) {
  return (
    <svg viewBox="0 0 76 40" width={width} height={(width * 40) / 76}>
      <path d="M12 25 Q3 22 1 27 Q6 29 12 28 Z" fill="currentColor" />
      <path d="M10 26 C10 17, 34 14, 54 16 C64 17, 68 22, 66 26 C62 31, 32 32, 14 30 C11 29, 10 28, 10 26 Z" fill="currentColor" />
      <circle cx="64" cy="19" r="8.5" fill="currentColor" />
      <circle cx="60" cy="11.5" r="2.4" fill="currentColor" />
      <circle cx="66.5" cy="18" r="1.5" fill={eye} />
      <circle cx="71.5" cy="21" r="1.4" fill={eye} />
      <path d="M18 18 L14 10 M24 17 L22 9" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <g className="pl-otter-paws">
        <ellipse cx="44" cy="9" rx="5" ry="3.6" fill="currentColor" />
        <path d="M38 15 L41 10 M50 15 L47 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function MantaSvg({ width = 96 }) {
  return (
    <svg viewBox="0 0 96 60" width={width} height={(width * 60) / 96}>
      <path d="M40 30 L1 31" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <g className="pl-manta-wings">
        <path d="M78 30 C66 14, 46 2, 34 2 C42 12, 44 20, 40 30 C44 40, 42 48, 34 58 C46 58, 66 46, 78 30 Z" fill="currentColor" />
      </g>
      <path d="M76 25 Q86 22 88 26 Q84 28 78 28 Z M76 35 Q86 38 88 34 Q84 32 78 32 Z" fill="currentColor" />
    </svg>
  );
}

export function OctopusSvg({ width = 46, eye = 'var(--hero-fish-eye)', className = 'pl-octo' }) {
  return (
    <svg viewBox="0 0 52 66" width={width} height={(width * 66) / 52} className={className}>
      <g className="pl-octo-arms">
        {[10, 18, 26, 34, 42].map((x, i) => (
          <path key={x} d={`M${x} 30 Q${x + (i % 2 ? 5 : -5)} 46 ${x + (i % 2 ? -2 : 2)} 63`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        ))}
      </g>
      <g className="pl-octo-head">
        <path d="M6 30 C4 12, 14 2, 26 2 C38 2, 48 12, 46 30 C40 35, 12 35, 6 30 Z" fill="currentColor" />
        <circle cx="19" cy="24" r="2.4" fill={eye} />
        <circle cx="33" cy="24" r="2.4" fill={eye} />
      </g>
    </svg>
  );
}

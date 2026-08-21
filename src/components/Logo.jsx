import React from 'react';

// SpeakLab mark — "The Kolba Bubble": a chemistry flask whose round body is
// also a speech bubble (chat tail + live typing dots). Inlined so it inherits
// the page and needs no extra request.
//
// FLAT, NOT GRADIENT. Two reasons. A three-hue gradient made the logo the
// loudest thing on a screen that is otherwise grey — and it could not follow
// the palette anyway: SVG <stop stop-color> would not resolve a CSS variable
// that itself pointed at another variable, so the mark silently rendered BLACK
// in light mode. Flat fills read the token directly and work everywhere.
export default function Logo({ width = 160, className = '', style = {} }) {
  return (
    <svg
      width={width}
      viewBox="0 0 470 150"
      className={className}
      // "Speak" inherits currentColor so it flips with the theme. It used to be
      // hard-coded #ffffff, which made the word invisible on a light background.
      style={{ color: 'var(--logo-wordmark)', ...style }}
      role="img"
      aria-label="SpeakLab"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="logo-wd-body"><circle cx="64" cy="88" r="30" /></clipPath>
      </defs>

      <g transform="translate(0,8) scale(0.92)">
        {/* Liquid, clipped to the flask body */}
        <g clipPath="url(#logo-wd-body)">
          <rect x="30" y="92" width="70" height="36" fill="var(--ai)" opacity="0.18" />
        </g>
        {/* Speech-bubble tail */}
        <path d="M46,110 L33,124 L56,116 Z" fill="var(--accent)" />
        {/* Flask body / bubble */}
        <circle cx="64" cy="88" r="30" fill="none" stroke="var(--accent)" strokeWidth="6.5" />
        {/* Neck + lip */}
        <path d="M54,36 L54,60 M74,36 L74,60" fill="none" stroke="var(--accent)" strokeWidth="6.5" strokeLinecap="round" />
        <line x1="47" y1="36" x2="81" y2="36" stroke="var(--accent)" strokeWidth="6.5" strokeLinecap="round" />
        {/* Typing dots — the one place the AI hue appears in the mark. */}
        <circle cx="52" cy="88" r="4.6" fill="var(--ai)" />
        <circle cx="64" cy="88" r="4.6" fill="var(--ai)" />
        <circle cx="76" cy="88" r="4.6" fill="var(--ai)" />
      </g>

      <text
        x="132"
        y="98"
        fontFamily="Outfit, 'Segoe UI', system-ui, sans-serif"
        fontWeight="800"
        fontSize="78"
        letterSpacing="-3"
      >
        <tspan fill="currentColor">Speak</tspan>
        <tspan fill="var(--accent)">Lab</tspan>
      </text>
    </svg>
  );
}

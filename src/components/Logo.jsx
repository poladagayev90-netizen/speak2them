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
//
// VIEWBOX IS 516 WIDE, NOT 470. At 78px the wordmark runs to roughly x=490, so
// the old 470-wide box clipped the final "b". It only looked correct because
// Outfit was never loaded and the Segoe UI fallback is narrower — the moment
// Outfit arrives as a webfont, 470 cuts the letter off.
//
// ANIMATED BY DEFAULT ON LARGE SIZES. Three bubbles rise out of the flask neck
// and fade before they reach the wordmark. Keyframes live in index.css
// (`logo-bubble` / `logo-bubble-drift`) because @keyframes cannot be inlined;
// prefers-reduced-motion is handled there too. Bubbles are suppressed below
// 140px, where they would be sub-pixel noise in the bottom nav or a header.
export default function Logo({ width = 160, className = '', style = {}, animated }) {
  const showBubbles = animated ?? width >= 140;

  return (
    <svg
      width={width}
      viewBox="0 0 516 150"
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

        {/* Bubbles leaving the neck. Staggered thirds of one 3.6s cycle so the
            stream never gaps and never doubles up. The violet one is the odd
            bubble out on purpose: it ties the mark's two hues together. */}
        {showBubbles && (
          <g>
            <circle
              cx="58" cy="33" r="6.4" fill="var(--ai)"
              style={{ animation: 'logo-bubble 3.6s ease-out infinite' }}
            />
            <circle
              cx="69" cy="33" r="4.4" fill="var(--ai-strong)"
              style={{ animation: 'logo-bubble-drift 3.6s ease-out 1.2s infinite' }}
            />
            <circle
              cx="63" cy="33" r="3.4" fill="var(--accent)"
              style={{ animation: 'logo-bubble 3.6s ease-out 2.4s infinite' }}
            />
          </g>
        )}

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

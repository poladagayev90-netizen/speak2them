import React from 'react';

// SpeakLab mark — "The Kolba Bubble": a chemistry flask whose round body is
// also a speech bubble (chat tail + live typing dots). Mirrors
// public/logo-wordmark-dark.svg; inlined so it inherits the page and needs no
// extra request. Gradient ids are prefixed to avoid clashing with the standalone
// SVGs if both ever render on one page.
export default function Logo({ width = 160, className = '', style = {} }) {
  return (
    <svg
      width={width}
      viewBox="0 0 470 150"
      className={className}
      style={style}
      role="img"
      aria-label="SpeakLab"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-wd-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.55" stopColor="#6D3BEB" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="logo-wd-liq" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#12BBD6" />
          <stop offset="1" stopColor="#7C4DFF" />
        </linearGradient>
        <clipPath id="logo-wd-body"><circle cx="64" cy="88" r="30" /></clipPath>
      </defs>

      <g transform="translate(0,8) scale(0.92)">
        {/* Liquid, clipped to the flask body */}
        <g clipPath="url(#logo-wd-body)">
          <rect x="30" y="92" width="70" height="36" fill="url(#logo-wd-liq)" opacity="0.2" />
        </g>
        {/* Speech-bubble tail */}
        <path d="M46,110 L33,124 L56,116 Z" fill="url(#logo-wd-grad)" />
        {/* Flask body / bubble */}
        <circle cx="64" cy="88" r="30" fill="none" stroke="url(#logo-wd-grad)" strokeWidth="6.5" />
        {/* Neck + lip */}
        <path d="M54,36 L54,60 M74,36 L74,60" fill="none" stroke="url(#logo-wd-grad)" strokeWidth="6.5" strokeLinecap="round" />
        <line x1="47" y1="36" x2="81" y2="36" stroke="url(#logo-wd-grad)" strokeWidth="6.5" strokeLinecap="round" />
        {/* Typing dots */}
        <circle cx="52" cy="88" r="4.6" fill="#12BBD6" />
        <circle cx="64" cy="88" r="4.6" fill="#6D3BEB" />
        <circle cx="76" cy="88" r="4.6" fill="#A855F7" />
      </g>

      <text
        x="132"
        y="98"
        fontFamily="Outfit, 'Segoe UI', system-ui, sans-serif"
        fontWeight="800"
        fontSize="78"
        letterSpacing="-3"
      >
        <tspan fill="#ffffff">Speak</tspan>
        <tspan fill="url(#logo-wd-grad)">Lab</tspan>
      </text>
    </svg>
  );
}

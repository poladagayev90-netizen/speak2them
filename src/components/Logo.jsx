import React from 'react';

export default function Logo({ width = 160, className = '', style = {} }) {
  return (
    <svg width={width} viewBox="0 0 330 90" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-purp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b794f4" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="logo-flaskGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="logo-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
      </defs>
      
      <text x="5" y="65" fontFamily="Outfit, system-ui, sans-serif" fontWeight="800" fontSize="56" fill="#ffffff" letterSpacing="-1.5">Speak</text>
      <text x="162" y="65" fontFamily="Outfit, system-ui, sans-serif" fontWeight="800" fontSize="56" fill="url(#logo-purp)" letterSpacing="-1.5">Lab</text>
      
      <g transform="translate(262, 12)">
        <path d="M 14 6 L 14 20 L 2 55 C 0 60 3 64 8 64 L 32 64 C 37 64 40 60 38 55 L 26 20 L 26 6 Z" fill="none" stroke="url(#logo-flaskGlass)" strokeWidth="3" strokeLinejoin="round"/>
        <rect x="11" y="2" width="18" height="4" fill="url(#logo-flaskGlass)" rx="2"/>
        <path d="M 6.5 44 L 33.5 44 L 37 54 C 38 58 36 61 32 61 L 8 61 C 4 61 2 58 3 54 Z" fill="url(#logo-liquid)"/>
        <path d="M 6.5 44 Q 20 48 33.5 44 Q 20 40 6.5 44 Z" fill="#c084fc" opacity="0.8"/>
        <g transform="translate(18, 28)" filter="url(#logo-glow)">
          <path d="M 8 0 C 3.6 0 0 3 0 6.5 C 0 8.5 1.2 10.3 3 11.5 L 2 15 L 6 13 C 6.6 13.2 7.3 13 8 13 C 12.4 13 16 10 16 6.5 C 16 3 12.4 0 8 0 Z" fill="#ffffff" />
        </g>
        <circle cx="12" cy="36" r="2" fill="#ffffff" opacity="0.9" filter="url(#logo-glow)"/>
        <circle cx="15" cy="42" r="1.5" fill="#ffffff" opacity="0.6"/>
        <path d="M 28 22 L 18 52" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      </g>
    </svg>
  );
}

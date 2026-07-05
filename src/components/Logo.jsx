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
        {/* Flask Outer Contour (Circle + Speech Bubble Pointer + Neck) */}
        <path d="M 16 4 L 24 4 L 24 22.6 A 14 14 0 1 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 16 22.6 L 16 4 Z" fill="none" stroke="url(#logo-flaskGlass)" strokeWidth="2.5" strokeLinejoin="round"/>
        {/* Flask Neck Lip */}
        <rect x="13" y="1" width="14" height="3" fill="url(#logo-flaskGlass)" rx="1.5"/>
        {/* Liquid Base */}
        <path d="M 6.3 33 A 14 14 0 0 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 6.3 33 Z" fill="url(#logo-liquid)"/>
        <path d="M 6.3 33 A 14 14 0 0 0 33.7 33 A 14 14 0 0 1 13 48.1 L 5 52 L 6.9 40.8 A 14 14 0 0 1 6.3 33 Z" fill="url(#logo-liquid)"/>
        {/* Liquid Surface Wave / 3D Oval Highlight */}
        <path d="M 6.3 33 Q 20 35.5 33.7 33 Q 20 30.5 6.3 33 Z" fill="#c084fc" opacity="0.8"/>
        {/* Glass Highlight Reflection */}
        <path d="M 29.5 30.5 A 11 11 0 0 1 27.8 43.8" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
        {/* Tiny Speech Bubble rising */}
        <g filter="url(#logo-glow)">
          <path d="M 18 23 C 19.5 23 20.5 24 20.5 25 C 20.5 26.2 19.5 27 18 27 C 17.5 27 17.1 27.2 16.7 27.5 L 16.2 28.5 L 16.5 27.2 C 15.8 27 15.5 26.2 15.5 25 C 15.5 24 16.5 23 18 23 Z" fill="#ffffff" opacity="0.9"/>
        </g>
        {/* Circular Bubbles */}
        <circle cx="25" cy="18" r="1.2" fill="#ffffff" opacity="0.8"/>
        <circle cx="21" cy="12" r="0.8" fill="#ffffff" opacity="0.6"/>
      </g>
    </svg>
  );
}

import React, { useState } from 'react';
import { heroClockStyle } from './plan/HeroFx';

// The card in the middle of an in-call activity (question, Taboo, debate).
//
// These used to be a fixed near-black slab in both themes — in light mode a
// dark hole in a white sheet. Polad (2026-10-01) asked for the Today hero's
// look instead: the same slow drift through the --hero-* purples and the same
// wandering light, so the thing both people are reading is the thing that is
// alive on the screen. Text inside uses --stage-ink*, which flips with the
// hero (white on the deep purples in light mode, dark ink on the pastels in
// dark mode).
//
// The drift lives on ::before / ::after, not on the element itself: the
// element keeps its own entrance animation (tabooCardIn) when a new card is
// dealt, and one element cannot run both on the `animation` property.
export default function StageCard({ className = '', style, children }) {
  // Phase taken once per mount from the wall clock (HeroFx), so the colours
  // carry on from Today instead of restarting with every card.
  const [clock] = useState(heroClockStyle);
  return (
    <div className={`stage-card ${className}`} style={{ ...clock, ...style }}>
      {children}
    </div>
  );
}

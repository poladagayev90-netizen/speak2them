import React from 'react';
import { Volume2 } from 'lucide-react';
import { canPronounce, pronounce } from '../../utils/pronounce';

// The speaker next to a word: tap to hear it (the recorded pronunciation when
// there is one — utils/pronounce.js). It never lets the tap reach the card
// under it, which usually opens or flips on a tap. Styles in App.css
// (.say-btn) and not ui.css, so no chunk gains a new CSS import.
export default function SayButton({ text, size = 18, className = '', label }) {
  if (!text || !canPronounce(text)) return null;
  return (
    <button
      type="button"
      className={`say-btn ${className}`.trim()}
      aria-label={label || `Hear “${text}”`}
      onClick={(e) => { e.stopPropagation(); pronounce(text); }}
    >
      <Volume2 size={size} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

import React from 'react';
import { Star } from 'lucide-react';

// Icon from lucide, not an emoji: a ⭐ renders in each platform's own emoji
// font and colour, which is the one yellow thing in a purple app. No glow
// either — nothing in the Plum system glows.

export default function PremiumBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      background: 'var(--ai-fill)',
      color: 'var(--text-on-ai)',
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 7px',
      borderRadius: '20px',
      marginLeft: '6px',
      whiteSpace: 'nowrap',
    }}>
      <Star size={10} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
      Pro
    </span>
  );
}

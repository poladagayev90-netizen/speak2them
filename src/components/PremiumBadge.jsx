import React from 'react';

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
      boxShadow: '0 0 8px var(--warning-bg)',
    }}>
      ⭐ Pro
    </span>
  );
}

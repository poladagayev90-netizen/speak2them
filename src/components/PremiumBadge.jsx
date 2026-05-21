import React from 'react';

export default function PremiumBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: '#1a1000',
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 7px',
      borderRadius: '20px',
      marginLeft: '6px',
      boxShadow: '0 0 8px #f59e0b55',
    }}>
      👑 Premium
    </span>
  );
}

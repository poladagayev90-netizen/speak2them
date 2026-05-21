import React from 'react';
import PremiumBadge from './PremiumBadge';

export default function RankingCard({ user, rank }) {
  const getMedalEmoji = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getMedalColor = (index) => {
    if (index === 0) return '#f59e0b';
    if (index === 1) return '#9ca3af';
    if (index === 2) return '#b45309';
    return '#666';
  };

  return (
    <div style={{
      background: '#1e1e30',
      border: `1px solid ${rank === 0 ? '#f59e0b' : rank === 1 ? '#9ca3af' : rank === 2 ? '#b45309' : '#2e2e50'}`,
      borderRadius: '14px',
      padding: '14px 16px',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{
        fontSize: '22px',
        fontWeight: 800,
        minWidth: '36px',
        textAlign: 'center',
        color: getMedalColor(rank),
      }}>
        {getMedalEmoji(rank)}
      </div>
      <div className="user-avatar" style={{ width: '40px', height: '40px', minWidth: '40px' }}>
        {user.photo
          ? <img src={user.photo} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          : user.name?.charAt(0).toUpperCase()
        }
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center' }}>
          {user.name}{user.isPremium && <PremiumBadge />}
        </p>
        <p style={{ fontSize: '11px', color: '#888' }}>{user.level || 'English Speaker'}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontWeight: 700, color: '#7c6ff7', fontSize: '15px' }}>{user.totalMinutes || 0} dəq</p>
        <p style={{ fontSize: '11px', color: '#888' }}>{user.callCount || 0} zəng</p>
        {user.streak > 0 && <p style={{ fontSize: '11px', color: '#f59e0b' }}>🔥 {user.streak}</p>}
      </div>
    </div>
  );
}
